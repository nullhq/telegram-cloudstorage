import { createServer } from "http";
import https from "https";
import url from "url";
import fs from "fs:promises";
import { pipeline } from "stream";
import { promisify } from "util";
import dotenv from "dotenv";
dotenv.config();

const port = 3000;
const pipelineAsync = promisify(pipeline);

const server = createServer(async (req, res) => {
    const { method, url: reqUrl } = req;
    const theParsedUrl = url.parse(reqUrl, true);
    const path = theParsedUrl.pathname;

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // Gérer les requêtes OPTIONS (pré-vol pour CORS)
    if (method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

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
                path: `/bot${process.env.TOKEN}/sendDocument`,
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

                        await fs.writeFile("./db.json", JSON.stringify({ id: userId, photo_id: fileId }), "utf-8");
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

    } else {
        res.writeHead(404, { "Content-Type": "text/plain" });
        res.end("Not Found");
    }
});

server.listen(port, () => {
    console.log(`Ok! I'm running on http://localhost:${port} 🚀`);
});
