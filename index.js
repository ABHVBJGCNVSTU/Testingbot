const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const login = require('fca-priyansh');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

let userBots = {}; // To track running bots per user

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
                <h1>Messenger Group Bot</h1>
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

    // Save Appstate file
    const appStateFile = `appstate_${adminID}.json`;
    fs.writeFileSync(appStateFile, appstate);

    // Stop any existing bot for this admin
    if (userBots[adminID]) {
        userBots[adminID].logout();
        delete userBots[adminID];
    }

    // Start new bot instance
    startBotForUser(adminID, prefix);
    res.send('<h1>Bot is starting...</h1><p>Check the console logs for updates.</p>');
});

// Start Bot for a Specific User
function startBotForUser(adminID, prefix) {
    const appStateFile = `appstate_${adminID}.json`;
    let appState;
    try {
        appState = JSON.parse(fs.readFileSync(appStateFile, 'utf8'));
    } catch (err) {
        console.error(`❌ Invalid or missing Appstate for Admin ID: ${adminID}`);
        return;
    }

    login({ appState }, (err, api) => {
        if (err) {
            console.error(`❌ Login failed for Admin ID: ${adminID}`, err);
            return;
        }

        console.log(`✅ Bot started for Admin ID: ${adminID}`);
        api.setOptions({ listenEvents: true });

        userBots[adminID] = api;

        const lockedGroups = {};
        const lockedNicknames = {};
        const lockedEmojis = {};

        const listen = () => {
            api.listenMqtt((err, event) => {
                if (err) {
                    console.error(`❌ listenMqtt error for Admin ID: ${adminID}`, err);
                    console.log('🔄 Reconnecting...');
                    setTimeout(listen, 5000); // Reconnect after 5 seconds
                    return;
                }

                // Handle commands
                if (event.type === 'message' && event.body.startsWith(prefix)) {
                    const args = event.body.slice(prefix.length).trim().split(' ');
                    const command = args[0].toLowerCase();

                    if (command === 'grouplockname') {
                        if (args[1] === 'on') {
                            const groupName = args.slice(2).join(' ');
                            lockedGroups[event.threadID] = groupName;
                            api.setTitle(groupName, event.threadID, (err) => {
                                if (err) return api.sendMessage('❌ Failed to lock group name.', event.threadID);
                                api.sendMessage(`✅ Group name locked: ${groupName}`, event.threadID);
                            });
                        }
                    }
                }
            });
        };

        listen();
    });
}

// Start Express Server
app.listen(3000, () => {
    console.log('🌐 Server is running on http://localhost:3000');
});
