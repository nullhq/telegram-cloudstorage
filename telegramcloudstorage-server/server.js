import { createServer } from "http";
import { pipeline } from "stream";
import { promisify } from "util";
import { TOKEN, PORT } from "./env.js";
import https from "https";
import url from "url";
import fs from "node:fs/promises";

const pipelineAsync = promisify(pipeline);

const server = createServer(async (req, res) => {
    const { method, url: reqUrl } = req;
    const theParsedUrl = url.parse(reqUrl, true);
    const path = theParsedUrl.pathname;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // handle cors preflight request
    if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    // handle the request to upload the new profile picture
    // here we well send file as document to save image quality
    // after that it will be stored in telegram servers
    if (path === "/files" && method === "POST") {
        const boundary = req.headers["content-type"].split("boundary=")[1]; // cause the content-type will be something like this "multipart/form-data; boundary=----WebKitFormBoundaryKo9A0D0h8axP5XKA"
        if (!boundary) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Invalid content type" }));
            return;
        }

        const chunks = [];
        req.on("data", (chunk) => chunks.push(chunk));
        req.on("end", async () => {
            const bodyBuffer = Buffer.concat(chunks);
            const options = {
                hostname: "api.telegram.org",
                path: `/bot${TOKEN}/sendDocument`,
                method: "POST",
                headers: {
                    "Content-Type": `multipart/form-data; boundary=${boundary}`,
                    "Content-Length": bodyBuffer.length,
                },
            };

            const tgSendPhotoReq = https.request(options, (tgSendPhotoRes) => {
                const tgChunks = [];
                tgSendPhotoRes.on("data", (chunk) => tgChunks.push(chunk));
                tgSendPhotoRes.on("end", async () => {
                    const tgSendPhotoBody = Buffer.concat(tgChunks).toString();
                    const tgSendPhotoResponse = JSON.parse(tgSendPhotoBody);

                    if (tgSendPhotoResponse.ok) {
                        const fileId = tgSendPhotoResponse.result.document.file_id;
                        const userId = tgSendPhotoResponse.result.chat.id;

                        const db = await fs.readFile("./db.json", "utf-8");
                        const filteredDb = JSON.parse(db).filter((user) => user.id !== userId);;
                        filteredDb.push({ id: userId, photo_id: fileId });

                        await fs.writeFile("./db.json", JSON.stringify(filteredDb), "utf-8");
                        res.writeHead(201, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ file_id: fileId }));
                    } else {
                        res.writeHead(400, { "Content-Type": "application/json" });
                        res.end(JSON.stringify({ error: "Telegram API error", details: tgSendPhotoResponse }));
                    }
                });
            });

            tgSendPhotoReq.on("error", (err) => {
                console.error("Telegram API request failed:", err);
                res.writeHead(500, { "Content-Type": "text/plain" });
                res.end("Internal Server Error");
            });

            tgSendPhotoReq.write(bodyBuffer);
            tgSendPhotoReq.end();
        });

    } else if (path.startsWith("/profiles/") && method === "GET") {
        const userId = path.split("/")[2];
        if (!userId) return;

        const db = await fs.readFile("./db.json", "utf-8");
        const currentUser = JSON.parse(db).find((user) => user.id == userId);

        if (currentUser) {
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(currentUser));
        } else {
            res.writeHead(404, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "User not found" }));
        }

        // route to get user's profile picture using the file_id
        // note that the only this that we store in our database is that fileId
        // all our file are stored in telegram servers !!
    } else if (path.startsWith("/files/") && method === "GET") {
        const fileId = path.split("/")[2];
        if (!fileId) return;

        const tgGetFilePathReq = https.get(`https://api.telegram.org/bot${TOKEN}/getFile?file_id=${fileId}`, (tgGetFilePathRes) => {
            const tgGetFilePathChunks = [];
            tgGetFilePathRes.on("data", (chunk) => tgGetFilePathChunks.push(chunk));
            tgGetFilePathRes.on("end", async () => {
                const tgGetFilePathBody = Buffer.concat(tgGetFilePathChunks).toString();
                const tgGetFilePathResponse = JSON.parse(tgGetFilePathBody);

                if (tgGetFilePathResponse.ok) {
                    const { file_path } = tgGetFilePathResponse.result;
                    const file_url = `https://api.telegram.org/file/bot${TOKEN}/${file_path}`;
                    const tgFileRes = await fetch(file_url);

                    let contentType = tgFileRes.headers.get("content-type");
                    if (file_path.endsWith(".jpg") || file_path.endsWith(".jpeg")) {
                        contentType = "image/jpeg";
                    } else if (file_path.endsWith(".png")) {
                        contentType = "image/png";
                    } else if (file_path.endsWith(".gif")) {
                        contentType = "image/gif";
                    }

                    res.writeHead(200, { "Content-Type": contentType });
                    await pipelineAsync(tgFileRes.body, res);
                }
            });
        });

        tgGetFilePathReq.on("error", (err) => {
            console.error("Telegram API request failed:", err);
            res.writeHead(500, { "Content-Type": "text/plain" });
            res.end("Internal Server Error");
        });

        tgGetFilePathReq.end();
    
    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    }
});

server.listen(PORT, () => {
    console.log(`Ok! I'm running on http://localhost:${PORT} 🚀`);
});