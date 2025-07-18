import React, { useState, useEffect, useContext, useRef } from 'react';
import { UserContext } from '../context/user.context';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../config/axios';
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket';
import Markdown from 'markdown-to-jsx';
import hljs from 'highlight.js';

function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)

            // hljs won't reprocess the element unless this attribute is removed
            ref.current.removeAttribute('data-highlighted')
        }
    }, [ props.className, props.children ])

    return <code {...props} ref={ref} />
}



const Project = () => {

    const location = useLocation()
    const navigate = useNavigate();

    const [ isSidePanelOpen, setIsSidePanelOpen ] = useState(false)
    const [ isModalOpen, setIsModalOpen ] = useState(false)
    const [ selectedUserId, setSelectedUserId ] = useState(new Set()) // Initialized as Set
    const [ project, setProject ] = useState(location.state.project)
    const [ message, setMessage ] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = React.createRef()

    const [ users, setUsers ] = useState([])
    const [ messages, setMessages ] = useState([]) // New state variable for messages
    const [ fileTree, setFileTree ] = useState({})

    const [ currentFile, setCurrentFile ] = useState(null)
    const [ openFiles, setOpenFiles ] = useState([])

    const [ iframeUrl, setIframeUrl ] = useState(null)

    const [ runProcess, setRunProcess ] = useState(null)
    const [ output, setOutput ] = useState(""); // State to store the output of the executed code
    
    // Check if current user is the creator of the project
    const [isCreator, setIsCreator] = useState(false);

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }

            return newSelectedUserId;
        });


    }

    const goBack = () => {
        navigate('/');
    }

    function addCollaborators() {

        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            console.log(res.data)
            setIsModalOpen(false)

        }).catch(err => {
            console.log(err)
        })

    }

    const removeCollaborator = (collaboratorId) => {
        if (!isCreator) return;

        axios.put("/projects/remove-user", {
            projectId: project._id,
            userToRemove: collaboratorId
        }).then(res => {
            setProject(res.data.project);
        }).catch(err => {
            console.log(err);
        });
    };

    const leaveProject = () => {
        const confirmed = window.confirm("Are you sure you want to leave this project?");
        if (!confirmed) return;

        axios.put("/projects/leave-project", {
            projectId: project._id
        }).then(res => {
            // Navigate back to home after leaving
            navigate('/');
        }).catch(err => {
            console.log(err);
        });
    };

    const send = () => {

        sendMessage('project-message', {
            message,
            sender: user
        })
        setMessages(prevMessages => [ ...prevMessages, { sender: user, message } ]) // Update messages state
        setMessage("")

    }

    function WriteAiMessage(message) {

        const messageObject = JSON.parse(message)

        return (
            <div
                className='overflow-auto bg-slate-950 text-white rounded-sm p-2'
            >
                <Markdown
                    children={messageObject.text}
                    options={{
                        overrides: {
                            code: SyntaxHighlightedCode,
                        },
                    }}
                />
            </div>)
    }

    useEffect(() => {

        initializeSocket(project._id);

        receiveMessage('project-message', data => {

            console.log(data);
            
            if (data.sender._id == 'ai') {


                const message = JSON.parse(data.message);

                console.log(message);


                if (message.fileTree) {
                    setFileTree(message.fileTree || {})
                }
                setMessages(prevMessages => [ ...prevMessages, data ]) // Update messages state
            } else {


                setMessages(prevMessages => [ ...prevMessages, data ]) // Update messages state
            }
        })


        axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {

            console.log(res.data.project)

            setProject(res.data.project)
            setFileTree(res.data.project.fileTree || {})
            
            // Check if the current user is the creator (first user in the users array)
            if (res.data.project.users && res.data.project.users.length > 0) {
                if (res.data.project.users[0]._id === user._id) {
                    setIsCreator(true);
                }
            }
        })

        axios.get('/users/all').then(res => {

            setUsers(res.data.users)

        }).catch(err => {

            console.log(err)

        })

    }, [])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.log(err)
        })
    }


    // Removed appendIncomingMessage and appendOutgoingMessage functions

    function scrollToBottom() {
        messageBox.current.scrollTop = messageBox.current.scrollHeight
    }

    

    return (
        <main className='h-screen w-screen flex bg-gradient-to-br from-blue-50 to-purple-100'>
            {/* Header */}
            <header className="w-full fixed top-0 left-0 flex justify-center items-center py-8 z-30 bg-gradient-to-r from-blue-50 to-purple-100" style={{height: '80px'}}>
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600 drop-shadow-lg tracking-wide">VAgent</h1>
            </header>
            {/* Main content row, with top padding to avoid header overlap */}
            <div className="flex flex-row w-full h-full pt-24" style={{height: '100vh'}}>
                <section className="left relative flex flex-col min-w-96 bg-white/80 rounded-tr-3xl rounded-br-3xl shadow-xl border-r-2 border-blue-200 ml-4 mb-4 h-full" style={{height: 'calc(100vh - 48px)'}}>
                    <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0'>
                        <div className="flex items-center gap-2">
                            <button className="back-button p-2" onClick={goBack}>
                                <i className="ri-arrow-left-line"></i>
                            </button>
                            <button className='flex gap-2' onClick={() => setIsModalOpen(true)}>
                                <i className="ri-add-fill mr-1"></i>
                                <p>Add collaborator</p>
                            </button>
                        </div>
                        <div className="flex items-center gap-2">
                            {!isCreator && (
                                <button 
                                    onClick={leaveProject}
                                    className="leave-project-btn text-red-500 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100"
                                >
                                    <i className="ri-logout-box-line"></i>
                                    <span>Leave</span>
                                </button>
                            )}
                            <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                                <i className="ri-group-fill"></i>
                            </button>
                        </div>
                    </header>
                    <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative rounded-2xl bg-white/90 shadow-inner mx-4 my-4">

                        <div
                            ref={messageBox}
                            className="message-box p-4 flex-grow flex flex-col gap-3 overflow-auto max-h-full scrollbar-hide">
                            {messages.map((msg, index) => (
                                <div key={index} className={`${msg.sender._id === 'ai' ? 'max-w-80' : 'max-w-52'} ${msg.sender._id == user._id.toString() && 'ml-auto'}  message flex flex-col p-3 bg-gradient-to-r from-blue-100 to-purple-100 w-fit rounded-xl shadow`}>
                                    <small className='opacity-65 text-xs'>{msg.sender.email}</small>
                                    <div className='text-sm'>
                                        {msg.sender._id === 'ai' ?
                                            WriteAiMessage(msg.message)
                                            : <p>{msg.message}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="inputField w-full flex absolute bottom-0 bg-white/80 rounded-b-2xl shadow-inner p-2">
                            <input
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        send();
                                    }
                                }}
                                className='p-2 px-4 border-none outline-none flex-grow' type="text" placeholder='Enter message' />
                            <button
                                onClick={send}
                                className='px-5 bg-slate-950 text-white'><i className="ri-send-plane-fill"></i></button>
                        </div>
                    </div>
                    <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-white/90 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0 rounded-2xl shadow-lg border-l-2 border-blue-200`}>
                        <header className='flex justify-between items-center px-4 p-2 bg-slate-200'>

                            <h1
                                className='font-semibold text-lg'
                            >Collaborators</h1>

                            <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="users flex flex-col gap-2">

                            {project.users && project.users.map((collaborator, index) => {
                                const isProjectCreator = index === 0;
                                const isCurrentUser = collaborator._id === user._id;
                                return (
                                    <div key={collaborator._id} className="user p-2 flex justify-between items-center hover:bg-slate-200">
                                        <div className="flex gap-2 items-center">
                                            <div className='aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                                <i className="ri-user-fill absolute"></i>
                                            </div>
                                            <div>
                                                <h1 className='font-semibold text-lg'>{collaborator.email}</h1>
                                                {isProjectCreator && <span className='text-xs text-gray-500'>Creator</span>}
                                                {isCurrentUser && !isProjectCreator && <span className='text-xs text-blue-500'>You</span>}
                                            </div>
                                        </div>
                                        <div>
                                            {isCreator && !isProjectCreator && !isCurrentUser && (
                                                <button 
                                                    onClick={() => removeCollaborator(collaborator._id)}
                                                    className="remove-user p-2 text-red-500 hover:bg-red-100 rounded-full"
                                                >
                                                    <i className="ri-close-circle-line"></i>
                                                </button>
                                            )}
                                            {isCurrentUser && !isProjectCreator && (
                                                <button 
                                                    onClick={leaveProject}
                                                    className="leave-project-btn text-red-500 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-100"
                                                >
                                                    <i className="ri-logout-box-line"></i>
                                                    <span>Leave</span>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </section>

                <section className="right flex-grow h-full flex flex-row" style={{height: 'calc(100vh - 48px)'}}>

                    {/* File Explorer and Code Editor side by side */}
                    <div className="explorer h-full max-w-64 min-w-52 bg-white/80 rounded-2xl shadow-lg m-4 border-2 border-blue-100 flex-shrink-0">
                        <div className="file-tree w-full p-2">
                            {
                                Object.keys(fileTree).map((file, index) => (
                                    <button
                                        key={index}
                                        onClick={() => {
                                            setCurrentFile(file)
                                            setOpenFiles([ ...new Set([ ...openFiles, file ]) ])
                                        }}
                                        className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-gradient-to-r from-blue-100 to-purple-100 w-full rounded-lg mb-2 shadow hover:bg-blue-200 transition-all">
                                        <p
                                            className='font-semibold text-lg'
                                        >{file}</p>
                                    </button>))

                            }
                        </div>
                    </div>

                    <div className="code-editor flex flex-col flex-grow h-full shrink bg-white/90 rounded-2xl shadow-lg m-4 border-2 border-purple-100" style={{ minHeight: 0, height: '100%' }}>

                        <div className="top flex justify-between w-full" style={{ zIndex: 10, background: 'transparent', position: 'relative' }}>

                            <div className="files flex">
                                {
                                    openFiles.map((file, index) => (
                                        <div key={index} className="flex items-center">
                                            <button
                                                onClick={() => setCurrentFile(file)}
                                                className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 ${currentFile === file ? 'bg-slate-400' : 'bg-slate-300'}`}>
                                                <p className='font-semibold text-lg'>{file}</p>
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setOpenFiles(openFiles.filter(openFile => openFile !== file));
                                                    if (currentFile === file) {
                                                        setCurrentFile(null); // Optionally reset currentFile if the closed file was active
                                                    }
                                                }}
                                                className={`close-button p-2 flex items-center justify-center ${currentFile === file ? 'bg-slate-400' : 'bg-slate-300'} text-white`}
                                                style={{ height: '100%' }}
                                            >
                                                <i className="ri-close-fill"></i>
                                            </button>
                                        </div>
                                    ))
                                }
                            </div>

                            
                            
                        </div>
                        <div className="bottom flex flex-grow max-w-full shrink overflow-auto">
                            {
                                fileTree[ currentFile ] && (
                                    <div className="code-editor-area h-full overflow-auto flex-grow bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-4">
                                        <pre
                                            className="hljs h-full">
                                            <code
                                                className="hljs h-full outline-none"
                                                contentEditable
                                                suppressContentEditableWarning
                                                onBlur={(e) => {
                                                    const updatedContent = e.target.innerText;
                                                    const ft = {
                                                        ...fileTree,
                                                        [ currentFile ]: {
                                                            file: {
                                                                contents: updatedContent
                                                            }
                                                        }
                                                    }
                                                    setFileTree(ft)
                                                    saveFileTree(ft)
                                                }}
                                                dangerouslySetInnerHTML={{ __html: hljs.highlight('javascript', fileTree[ currentFile ].file.contents).value }}
                                                style={{
                                                    whiteSpace: 'pre-wrap',
                                                    paddingBottom: '25rem',
                                                    counterSet: 'line-numbering',
                                                }}
                                            />
                                        </pre>
                                    </div>
                                )
                            }
                        </div>
                        

                    </div>


                </section>

            </div>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 max-w-full relative">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="users-list flex flex-col gap-2 mb-16 max-h-96 overflow-auto">
                            {users.map(user => (
                                <div key={user.id} className={`user cursor-pointer hover:bg-slate-200 ${Array.from(selectedUserId).indexOf(user._id) != -1 ? 'bg-slate-200' : ""} p-2 flex gap-2 items-center`} onClick={() => handleUserClick(user._id)}>
                                    <div className='aspect-square relative rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className='absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-md'>
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project