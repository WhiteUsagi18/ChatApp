import React, { useEffect } from 'react';
import io from 'socket.io-client';

const SERVER_URL = 'http://localhost:3000';
const socket = io(SERVER_URL);

function Test() {
    console.log('Chat component rendered');

    useEffect(() => {
        console.log('Setting up socket listeners');
        socket.on('connect', () => {
            console.log('Connected to server');
        });
    
        socket.on('test', (message) => {
            console.log('Test message from server:', message);
        });
    
        return () => {
            console.log('Cleaning up socket');
            socket.disconnect();
        };
    }, []);

    return (
        <div>
            <h1>Chat Component</h1>
            {/* Add other chat UI components here */}
        </div>
    );
}

export default Test;
