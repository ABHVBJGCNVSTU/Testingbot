const fs = require('fs');
const express = require('express');
const bodyParser = require('body-parser');
const login = require('fca-priyansh');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));

let botConfig = {}; // To store adminID, prefix, etc.
let userAppStates = {}; // Store AppStates for multiple users

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
                .whatsapp-button {
                    background-color: #25D366;
                    color: white;
                    margin-top: 10px;
                }
                .whatsapp-button:hover {
                    background-color: #1EBE5D;
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>Messenger Group Name Lock</h1>
                <h2>Owner: Mian Amir</h2>
                <form method="POST" action="/configure">
                    <label for="adminID">Admin ID:</label>
                    <input type="text" id="adminID" name="adminID" placeholder="Enter your Admin ID" required>

                    <label for="prefix">Command Prefix:</label>
                    <input type="text" id="prefix" name="prefix" value="." placeholder="Enter command prefix" required>

                    <label for="appstate">Appstate (Paste JSON):</label>
                    <textarea id="appstate" name="appstate" rows="10" placeholder="Paste your Appstate JSON here
                    
Bot start krny k bad group mai add kro bot id aur command likho group mai .grouplockname on (New Name)" required></textarea>

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

    // Assign a unique user ID for AppState
    const userID = `user_${Date.now()}`;
    userAppStates[userID] = JSON.parse(appstate);

    // Save Configuration
    botConfig[userID] = { adminID, prefix };
    fs.writeFileSync(`appstate_${userID}.json`, appstate);

    console.log(`✅ New AppState added for User: ${userID}, AdminID: ${adminID}`);
    res.send('<h1>Bot is starting...</h1><p>Go back to the Replit console to see logs.</p>');

    startBot(userID); // Start the bot for this user
});

// Start the Bot
function startBot(userID) {
    let appState;
    try {
        appState = userAppStates[userID];
    } catch (err) {
        console.error(`❌ Invalid AppState for User: ${userID}`);
        return;
    }

    login({ appState }, (err, api) => {
        if (err) {
            console.error(`❌ Login failed for User: ${userID}`, err);
            return;
        }

        console.log(`✅ Bot is running for User: ${userID}`);
        api.setOptions({ listenEvents: true });

        api.listenMqtt((err, event) => {
            if (err) return console.error(err);

            if (event.type === 'message' && event.body.startsWith(botConfig[userID].prefix)) {
                const senderID = event.senderID;
                const args = event.body.slice(botConfig[userID].prefix.length).trim().split(' ');
                const command = args[0].toLowerCase();

                if (senderID !== botConfig[userID].adminID) {
                    return api.sendMessage('❌ You are not authorized to use this command.', event.threadID);
                }

                if (command === 'lockstatus') {
                    api.sendMessage(`✅ Bot is running for user: ${userID}`, event.threadID);
                }
            }
        });
    });
}

// API to Show All AppStates
app.get('/list-appstates', (req, res) => {
    console.log(`Current AppStates:`);
    Object.keys(userAppStates).forEach((userID) => {
        console.log(`UserID: ${userID}, AppState: ${JSON.stringify(userAppStates[userID], null, 2)}`);
    });

    res.send('<h1>All AppStates have been logged to the console.</h1>');
});

// Start Express Server
app.listen(3000, () => {
    console.log('🌐 Server is running on http://localhost:3000');
});
