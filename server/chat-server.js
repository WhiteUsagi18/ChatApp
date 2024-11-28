const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mysql = require('mysql')
const bcrypt = require('bcrypt')
const fs = require('fs')
const path = require('path')
const chokidar = require('chokidar');

const cookieParser = require('cookie-parser')
const bodyParser = require('body-parser')
const session = require('express-session');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",  // Ensure this matches the client URL
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(express.json());
app.use(cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    credentials: true
}));
app.use(cookieParser())
app.use(bodyParser.urlencoded({ extended: true }))

app.use(session({
    key: "userID",
    secret: "nothing",
    resave: false,
    saveUninitialized: false,
    cookie: {
        expires: 60*10*1000
    }
}))

const dataPath = path.join(__dirname, '../user data/data.json');

// Connect to the database
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'chatapp'
})

db.connect(err => {
    if (err) {
        console.error('Database connection error:', err)
        process.exit(1) // Exit process if database connection fails
    }
    console.log('Connected to database.')
})

const clients = new Map();

io.on('connection', (socket) => {
    console.log(`User connected with socket ID: ${socket.id}`);

    socket.on('register', user => {
        clients.set(user, socket.id);
        console.log(`User registered: ${user} with socket ID: ${socket.id}`);
    });

    socket.on('chat message', message => {
        const { to, text, from, time } = message; // Include 'from' for sender info
        const recipientSocketId = clients.get(to);
        console.log(`${from} sent a message to ${to}: ${text}`);
        console.log(clients)

        if (recipientSocketId) {
            writeMessage(dataPath, message, [from], [to])
            io.to(recipientSocketId).emit('message', { text, time, sender: from, });
        }

        else if(readUser(dataPath, [from], [to])) {
            writeMessage(dataPath, message, [from], [to])
        }
        
        else {
            console.log("Recipient and the user not found");
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected with socket ID: ${socket.id}`);
        // Optional: Handle cleanup or additional logic on disconnect
        // For example, removing the disconnected user's socket ID from the clients map
        for (let [user, socketId] of clients.entries()) {
            if (socketId === socket.id) {
                clients.delete(user);
                console.log(`Removed user ${user} from the clients map`);
                break;
            }
        }
    });
});

const readUser = (filePath, from, to) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filePath, 'utf8', (readErr, data) => {
            if (readErr) {
                console.error('Error reading file:', readErr);
                return reject(readErr);
            }

            let jsonObject;
            try {
                jsonObject = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing JSON:', parseErr);
                return reject(parseErr);
            }

            const toUser = jsonObject[from]?.receiver.find(r => r.username === to);
            
            resolve(!!toUser);  // Resolve with true or false
        });
    });
}

const writeMessage = (filePath, message, from, to) => {
    fs.readFile(filePath, 'utf-8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return;
        }

        let jsonObject;
        try {
            jsonObject = JSON.parse(data);
        } catch (parseErr) {
            console.error('Error parsing JSON:', parseErr);
            return;
        }

        // Check if the sender exists in the JSON object
        if (!jsonObject[from]) {
            console.error(`User ${from} not found in JSON data.`);
            return;
        }

        const getUsername = username => {
            const user = jsonObject[username];
    
            // Check if the sender has a receiver list
            if (!user.receiver) {
                console.error(`User ${username} does not have a list.`);
                return;
            }

            return user
        }

        // Find the receiver in the sender's receiver list
        const receiverInSender = getUsername(from).receiver.find(r => r.username == to);
        const senderInReciver = getUsername(to).receiver.find(r => r.username == from);
        console.log(`Searching for receiver ${to}`);
        console.log('Found receiver:', receiverInSender);
        

        if (!receiverInSender) {
            console.error(`Receiver ${to} not found in ${from}'s receiver list.`);
            return;
        }

        // Ensure the receiver exists in the JSON object
        if (!jsonObject[to]) {
            console.error(`User ${to} not found in JSON data.`);
            return;
        }

        // Ensure the receiver has a 'messages' array
        if (!receiverInSender.messages) {
            receiverInSender.messages = [];
        }
        receiverInSender.messages.push({ send: message.text, time: message.time });

        if (!senderInReciver.messages) {
            senderInReciver.messages = [];
        }
        senderInReciver.messages.push({ receive: message.text, time: message.time });

        // Add the message to the receiver's messages
        console.log(JSON.stringify(jsonObject, null, 2))

        fs.writeFile(filePath, JSON.stringify(jsonObject, null, 2), 'utf-8', (writeErr) => {
            if (writeErr) {
                console.error('Error writing file:', writeErr);
            } else {
                console.log('Message saved successfully.');
            }
        });
    });
};


const watcher = chokidar.watch(dataPath, {
    persistent: true
});

watcher.on('change', (path) => {
    console.log(`${path} has been changed`);
    io.emit('data update'); // Notify clients of the change
});

app.get('/api/receivers/:username', (req, res) => {
    const username = req.params.username;
    
    // Load JSON data
    fs.readFile(dataPath, 'utf8', (readErr, data) => {
        if (readErr) {
            console.error('Error reading JSON file:', readErr);
            return res.status(500).json({ error: 'Server error' });
        }

        let parsedData;
        try {
            parsedData = JSON.parse(data);
        }catch (parseErr) {
            console.error('Error parsing JSON data:', parseErr);
            return res.status(500).json({ error: 'Server error' });
        }

        const user = parsedData[username];
        if (user) {
            res.json(user.receiver);
        } else {
            res.status(404).json({ error: 'User not found' });
        }
    });
});

app.get('/api/receivers/:from/:to', (req, res) => {
    const { from, to } = req.params;
    
    // Load JSON data
    fs.readFile(dataPath, 'utf8', (readErr, data) => {
        if (readErr) {
            console.error('Error reading JSON file:', readErr);
            return res.status(500).json({ error: 'Server error reading file' });
        }

        let parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch (parseErr) {
            console.error('Error parsing JSON data:', parseErr);
            return res.status(500).json({ error: 'Server error parsing JSON' });
        }

        const userFrom = parsedData[from]?.receiver.find(r => r.username === to) || { messages: [] };
        const userTo = parsedData[to]?.receiver.find(r => r.username === from) || { messages: [] };

        if (!userFrom && !userTo) {
            return res.status(404).json({ error: 'User(s) not found' });
        }

        res.json({ userFrom, userTo });
    });
});

app.post('/api/receivers/', (req, res) => {
    const { username, idUser, usernameTo, id } = req.body

    fs.readFile(dataPath, 'utf8', (readErr, data) => {
        if (readErr) {
            console.error('Error reading JSON file:', readErr);
            return res.status(500).json({ error: 'Server error reading file' });
        }

        let parsedData;
        try {
            parsedData = JSON.parse(data);
        } catch (parseErr) {
            console.error('Error parsing JSON data:', parseErr);
            return res.status(500).json({ error: 'Server error parsing JSON' });
        }

        const fromAddReciver = parsedData[username]
        const toAddreceiver = parsedData[usernameTo]

        if(!fromAddReciver.receiver) {
            fromAddReciver.receiver = []
        }

        if(!toAddreceiver.receiver) {
            toAddreceiver.receiver = []
        }

        fromAddReciver.receiver.push({
            id: id,
            username: usernameTo
        })

        toAddreceiver.receiver.push({
            id: idUser,
            username: username
        })

        fs.writeFile(dataPath, JSON.stringify(parsedData, null, 2), 'utf-8', (writeErr) => {
            if (writeErr) {
                console.error('Error writing file:', writeErr);
            } else {
                console.log('receiver saved successfully.');
            }
        });
    });
})

app.get('/search', (req, res) => {
    const query = req.query.q
    const username = req.query.username
    const receivers = JSON.parse(req.query.receiver)

    const escapedUsername = username.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
    const escapedReceivers = receivers.map(receiver => receiver.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&'));

    let sql;
    if(query) {
        if(receivers == 0) {
            sql = `SELECT * FROM users WHERE username LIKE '%${query}%' AND NOT username = '${escapedUsername}'`;
        }

        else {
            sql = `SELECT * FROM users WHERE username LIKE '%${query}%' AND NOT (username = '${escapedUsername}' OR username IN ('${escapedReceivers.join("','")}'))`;
        }
    }

    else {
        if(receivers == 0) {
            sql = `SELECT * FROM users WHERE NOT username = '${escapedUsername}'`;
        }

        else {
            sql = `SELECT * FROM users WHERE NOT (username = '${escapedUsername}' OR username IN ('${escapedReceivers.join("','")}'))`;
        }
    }

    console.log(sql)
    
    db.query(sql, (err, results) => {
        if (err) {
        return res.status(500).json({ error: 'Database query failed' });
        }
        
        res.json(results);
    });
});


/* A function that will be call in register to store
username in JSON
*/
const updateJSON = (result, filePath) => {
    const userData = result.reduce((acc, row) => {
        if (!acc[row.username]) {
            acc[row.username] = {};
        }
        acc[row.username] = {id: row.id}
        return acc;
    }, {});
    
    // Read the existing JSON file
    fs.readFile(filePath, 'utf8', (readErr, data) => {
        let existingData = {};

        if (!readErr) {
            try {
                existingData = JSON.parse(data);
            } catch (parseErr) {
                console.error('Error parsing existing JSON data:', parseErr);
            }
        }

        // Merge new user data with existing data
        const updatedData = { ...existingData, ...userData };

        // Convert the updated data to a JSON string
        const jsonData = JSON.stringify(updatedData, null, 2);

        // Write the updated JSON string to the file
        fs.writeFile(filePath, jsonData, (writeErr) => {
            if (writeErr) {
                console.error('Error writing file:', writeErr);
            } else {
                console.log('JSON file has been updated.');
            }
        });
    });
}

// Handle the register
app.post('/register', (req, res) => {
    const { username, password } = req.body

    const sql = "SELECT username FROM users WHERE username=?"
    db.query(sql, [username], async (err, result) => {
        if(err) {
            console.error('Database error:', err)
            return res.status(500).json({ error: 'Database error' })
        }

        if(result.length > 0) {
            return res.status(401).json({ message: 'Choose another username' })
        }

        else {
            try {
                if(password.length < 3) {
                    return res.status(401).json({ message: 'Password too short' })
                }

                else {
                    const rounds = 10
                    const hashedPass = await bcrypt.hash(password, rounds)
            
                    // SQL query
                    const sql = "INSERT INTO users (username, password) VALUES (?, ?)"
                    const values = [
                        username,
                        hashedPass
                    ]
            
                    db.query(sql, values, (err, result) => {
                        if (err) {
                            console.error('Error inserting data:', err)
                            return res.status(500).json({ error: 'Failed to register user' })
                        }
                        
                        const sql = "SELECT id, username FROM users WHERE username=?"
                        db.query(sql, [username], (err, result) => {
                            if (err) {
                                console.error('Error fetching user data:', err)
                                return res.status(500).json({ error: 'Failed to fetch user data' })
                            }
        
                            if (result.length > 0) {
                                const userInfo = result[0]
                                req.session.user = {
                                    id: userInfo.id,
                                    username: userInfo.username,
                                }
                                console.log(req.session.user)
                            }

                            updateJSON(result, dataPath)
        
                            res.status(200).json({ message: 'User registered successfully' })
                        })
                    })
                }
            }
            
            catch (err) {
                console.error('Hashing error:', err)
                return res.status(500).json({ error: 'Server error during registration' })
            }
        }
    })
})

//Handle the login
app.post('/login', (req, res) => {
    const { username, password } = req.body

    const sql = "SELECT * FROM users WHERE username=?"
    db.query(sql, [username], async (err, result) => {
        if (err) {
            console.error('Database error:', err)
            return res.status(500).json({ error: 'Database error' })
        }

        if (result.length === 0) { // Correctly check for empty result
            return res.status(401).json({ message: 'Invalid username' })
        }

        const userInfo =  result[0]
        const hashedPass = userInfo.password

        try {
            const match = await bcrypt.compare(password, hashedPass)
            if (match) {
                req.session.user = {
                    id: userInfo.id,
                    username: userInfo.username,
                }
                console.log(req.session.user)
                return res.status(200).json({ message: 'Login Successful' })
            }
            
            else {
                return res.status(401).json({ message: 'Invalid password' })
            }
        }
        
        catch (err) {
            console.error('Hashing error:', err)
            return res.status(500).json({ error: 'Server error during login' })
        }
    })
})

// Handle the logout
app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error('Session destruction error:', err);
            return res.status(500).json({ error: 'Failed to log out' });
        }

        res.clearCookie('userID');
        res.status(200).json({ message: 'Logged out successfully' });
    });
});

app.get('/login', (req, res) => {
    if(req.session.user) {
        res.send({ 
            loggedIn: true,
            user: req.session.user
        })
    }

    else {
        res.send({ 
            loggedIn: false
        })
    }
})

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}...`);
});
