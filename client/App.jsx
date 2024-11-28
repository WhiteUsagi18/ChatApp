import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import axios from 'axios'
import Chat from './pages/Chat.jsx'
import Register from './pages/Register.jsx'
import Login from './pages/Login.jsx'


function App() {
  axios.defaults.withCredentials = true
  return (
    <>
    <Routes>
      <Route path='/' element={<Chat />} />
      <Route path='/register' element={<Register />} />
      <Route path='/login' element={<Login />} />
      <Route path='*' element={<Navigate to = '/' />} />
    </Routes>
    </>
  )
}

export default App
