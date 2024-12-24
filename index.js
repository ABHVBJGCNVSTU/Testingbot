const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const login = require('fca-priyansh');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

let bots = {}; // To store bots for multiple users
let botConfig = {}; // To store adminID, prefix, etc. for each user

// Serve the HTML Form
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Messenger Bot Configuration</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    background-color: #f4f4f9;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    height: 100vh;
                }
                .container {
                    background: #fff;
                    padding: 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                    width: 90%;
                    max-width: 500px;
                    text-align: center;
                }
                h1 {
                    font-size: 24px;
                    margin-bottom: 20px;
                }
                label {
                    font-weight: bold;
                }
                input, textarea, button {
                    width: 100%;
                    margin: 10px 0;
                    padding: 10px;
                    font-size: 16px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                }
                button {
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    cursor: pointer;
                }
                button:hover {
                    background-color: #45a049;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Messenger Group Name Lock</h1>
                <form method="POST" action="/configure">
                    <label for="adminID">Admin ID:</label>
                    <input type="text" id="adminID" name="adminID" placeholder="Enter your Admin ID" required>

                    <label for="prefix">Command Prefix:</label>
                    <input type="text" id="prefix" name="prefix" value="." placeholder="Enter command prefix" required>

                    <label for="appstate">Appstate (Paste JSON):</label>
                    <textarea id="appstate" name="appstate" rows="10" placeholder="Paste your Appstate JSON here" required></textarea>

                    <button type="submit">Start Bot</button>
                </form>
            </div>
        </body>
        </html>
    `);
});

// Handle Configuration Form Submission
app.post('/configure', (req, res) => {
    const { adminID, prefix, appstate } = req.body;

    // Assign a unique user ID for each user
    const userID = `user_${Date.now()}`;
    botConfig[userID] = { adminID, prefix, appstate };

    // Save AppState to a file
    fs.writeFileSync(`appstate_${userID}.json`, appstate);

    // Start the bot for this user
    startBot(userID, JSON.parse(appstate));

    res.send('<h1>Bot is starting...</h1><p>Go back to the Replit console to see logs.</p>');
});

// Start the Bot for a User
function startBot(userID, appState) {
    if (bots[userID]) {
        console.log(`⚠️ Bot for User: ${userID} is already running.`);
        return;
    }

    login({ appState }, (err, api) => {
        if (err) {
            console.error(`❌ Login failed for User: ${userID}`, err);
            return;
        }

        console.log(`✅ Bot started for User: ${userID}`);
        api.setOptions({ listenEvents: true });

        const lockedGroups = {};
        const lockedNicknames = {};
        const lockedEmojis = {};

        // Save the bot instance
        bots[userID] = api;

        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            const { adminID, prefix } = botConfig[userID];
            if (event.type === 'message' && event.body.startsWith(prefix)) {
                const senderID = event.senderID;
                const args = event.body.slice(prefix.length).trim().split(' ');
                const command = args[0].toLowerCase();
                const lockValue = args.slice(2).join(' ');

                if (senderID !== adminID) {
                    return api.sendMessage('❌ You are not authorized to use this command.', event.threadID);
                }

                if (command === 'grouplockname' && args[1] === 'on') {
                    lockedGroups[event.threadID] = lockValue;
                    api.setTitle(lockValue, event.threadID, (err) => {
                        if (err) return api.sendMessage('❌ Failed to lock group name.', event.threadID);
                        api.sendMessage(`✅ Group name locked as: ${lockValue}`, event.threadID);
                    });
                } else if (command === 'lockstatus') {
                    const lockStatus = `🔒 Lock Status:\nGroup Name: ${
                        lockedGroups[event.threadID] || 'Not locked'
                    }`;
                    api.sendMessage(lockStatus, event.threadID);
                }
            }

            if (event.logMessageType === 'log:thread-name') {
                const lockedName = lockedGroups[event.threadID];
                if (lockedName) {
                    api.setTitle(lockedName, event.threadID, (err) => {
                        if (!err) api.sendMessage('❌ Group name change reverted.', event.threadID);
                    });
                }
            }
        });
    });
}

// Start Express Server
app.listen(3000, () => {
    console.log('🌐 Server is running on http://localhost:3000');
});
