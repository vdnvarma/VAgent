import jwt from "jsonwebtoken";
import redisCliet from "../services/redis.service.js";

export const authUser = async (req, res, next) => {
    try{
        const token = req.cookies.token || req.headers.authorization.split(' ')[ 1 ];
        if(!token){
            res.status(401).send({error: "Unauthorized User"});
        }

        const isBlackListed = await redisCliet.get(token);
        
        if(isBlackListed){
            res.cookie('token', '');
            res.status(401).send({error: "Unauthorized User"});
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }catch(error){
        console.log(error);
        res.status(401).send({error: "Unauthorized User"});
    }
}