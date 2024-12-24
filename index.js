const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const login = require('fca-priyansh');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

// Object to store bot instances and configurations
let botInstances = {};

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
                <h1>Messenger Bot Configuration</h1>
                <form method="POST" action="/configure">
                    <label for="adminID">Admin ID:</label>
                    <input type="text" id="adminID" name="adminID" placeholder="Enter your Admin ID" required>
                    <label for="prefix">Command Prefix:</label>
                    <input type="text" id="prefix" name="prefix" value="." required>
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

    // Save Appstate in a separate file for each user
    const appstateFile = `appstate_${adminID}.json`;
    fs.writeFileSync(appstateFile, appstate);

    // If a bot instance for this user already exists, logout the previous one
    if (botInstances[adminID]) {
        botInstances[adminID].api.logout();
        delete botInstances[adminID];
    }

    // Start a new bot instance for this user
    startBot(adminID, prefix, appstateFile);

    res.send('<h1>Bot is starting...</h1><p>Check the console for logs.</p>');
});

// Function to start the bot for a specific user
function startBot(adminID, prefix, appstateFile) {
    let appState;
    try {
        appState = JSON.parse(fs.readFileSync(appstateFile, 'utf8'));
    } catch (err) {
        console.error(`❌ Invalid appstate file for user ${adminID}.`);
        return;
    }

    login({ appState }, (err, api) => {
        if (err) {
            console.error(`❌ Login failed for user ${adminID}:`, err);
            return;
        }

        console.log(`✅ Bot is running for Admin ID: ${adminID}`);
        api.setOptions({ listenEvents: true });

        const lockedGroups = {};
        botInstances[adminID] = { api, prefix, lockedGroups };

        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            if (event.type === 'message' && event.body.startsWith(prefix)) {
                const args = event.body.slice(prefix.length).trim().split(' ');
                const command = args[0].toLowerCase();
                const lockValue = args.slice(2).join(' ');

                if (event.senderID !== adminID) {
                    return api.sendMessage('❌ You are not authorized to use this command.', event.threadID);
                }

                if (command === 'grouplockname' && args[1] === 'on') {
                    lockedGroups[event.threadID] = lockValue;
                    api.setTitle(lockValue, event.threadID, (err) => {
                        if (err) return api.sendMessage('❌ Failed to lock group name.', event.threadID);
                        api.sendMessage(`✅ Group name locked as: ${lockValue}`, event.threadID);
                    });
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
