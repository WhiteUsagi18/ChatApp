import React, { useEffect, useState } from 'react';
import axios from 'axios'
import { useNavigate } from 'react-router-dom';
import './css/LoginRegister.css';

const Login = () => {
    // Correctly destructure useState
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const navigate = useNavigate()

    const handleSubmit = (e) => {
        e.preventDefault();
        const values = { username, password }; // Collect form values
        axios.post('http://localhost:3000/login', values)
        .then(res => {
            alert(res.data.message);
            console.log(res.data.data)
            if(res.status == 200) {
                navigate('/chat')
            }
        })
        .catch(err => {
            alert(err.response?.data?.message || 'An error occurred');
        });
    };

    return (
        <>
            <Header />
            <div className="center">
                <Form handleSubmit={handleSubmit} setUsername={setUsername} setPassword={setPassword} />
            </div>
        </>
    );
};

const Header = () => {
    return (
        <>
            <h1 className='h1LoginRegister'><span className='chat'>Chat</span><span className='app'>App</span></h1>
            <p className='header-p'>A Chatting Platform</p>
        </>
    );
};

const Form = ({ handleSubmit, setUsername, setPassword }) => {
    return (
        <>
            <form className='formLoginRegister' onSubmit={handleSubmit}>
                <h3>Login</h3>
                <div className="input-container">
                    <Input setUsername={setUsername} setPassword={setPassword} />
                </div>
                <div className="button">
                    <button className='submit'>Login</button>
                </div>
            </form>
        </>
    );
};

const Input = ({ setUsername, setPassword }) => {
    return (
        <div>
            <input
                type="text"
                placeholder='Username'
                required
                onChange={e => setUsername(e.target.value)}
            /><br />
            <input
                type="password"
                placeholder='Password'
                required
                onChange={e => setPassword(e.target.value)}
            /><br />
            <p>Don't have an account? <a href="/register">Register</a> now</p>
        </div>
    );
};

export default Login;
