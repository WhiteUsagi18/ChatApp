import React, { useState } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'
import './css/LoginRegister.css'

const Register = () => {
    //default value is null string in object
    const [values, setValues] = useState({
        username: '',
        password: ''
    })

    const navigate = useNavigate()

    //set the value based on the name attribute
    const handleChange = (e) => {
        setValues({...values,
            [e.target.name]: e.target.value
        })
    }

    //send to server's port to handle the input
    const handleSubmit = (e) => {
        e.preventDefault();
        axios.post('http://localhost:3000/register', values)
        .then(res => {
            alert(res.data.message);
            if(res.status == 200) {
                navigate('/chat')
            }
        })
        .catch(err => {
            alert(err.response?.data?.message || 'An error occurred');
        });
    }

    return(
        <>
        <Header />
        <div className="center">
            <Form handleSubmit={handleSubmit} handleChange={handleChange} />
        </div>
        </>
    )
}

const Header = () => {
    return(
        <>
        <h1 className='h1LoginRegister'><span className='chat'>Chat</span><span className='app'>App</span></h1>
        <p className='header-p'>A Chatting Platform</p>
        </>
    )
}

const Form = ({ handleSubmit, handleChange }) => {
    return(
        <>
        <form className='formLoginRegister' onSubmit={handleSubmit}>
            <h3>Sign Up</h3>
            <div className="input-container">
                <Input handleChange={handleChange} />
            </div>
            <div className="button">
                <button type='submit' className='submit'>Register Now</button>
            </div>
        </form>
        </>
    )
}

const Input = ({ handleChange }) => {
    return(
    <div>
        <input type="text"
        placeholder='Username'
        name='username'
        required
        onChange={handleChange}/><br />

        <input type="password"
        placeholder='Password'
        name='password'
        required
        onChange={handleChange}/><br />
        <p>Already have an account? Return to <a href="/login">Login</a></p>
    </div>
    )
}

export default Register