import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import './css/Chat.css';
import { Menu, MessageSquare, Search, User, Send, Plus, X, LogIn, LogOut } from 'react-feather';

const SERVER_URL = 'http://localhost:3000';

function Chat() {
    const [isSquare, setIsSquare] = useState(false);
    const [loginStatus, setLoginStatus] = useState('');
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [idUser, setIdUser] = useState()
    const [socket, setSocket] = useState(null);
    const [username, setUsername] = useState('');
    const [receivers, setReceivers] = useState([]);
    const [selectedReceiver, setSelectedReceiver] = useState(null);
    const [message, setMessage] = useState('');
    const [printMessage, setPrintMessage] = useState([]);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState([]);
    const navigate = useNavigate();

    const formatTime = (date) => {
        let hours = date.getHours();
        const minutes = date.getMinutes();
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12;
        hours = hours ? hours : 12; // the hour '0' should be '12'
        const minutesFormatted = minutes < 10 ? '0' + minutes : minutes;
        return hours + ':' + minutesFormatted + ' ' + ampm;
    };

    const toggleShape = () => {
        setIsSquare(prev => !prev);
    };

    useEffect(() => {
        let isMounted = true;

        axios.get(`${SERVER_URL}/login`)
            .then(response => {
                if (response.data.loggedIn) {
                    const username = response.data.user.username
                    setUsername(username)
                    setLoginStatus(username);
                    setIdUser(response.data.user.id)
                    setIsLoggedIn(true);

                    if (isMounted) {
                        const newSocket = io(SERVER_URL, { transports: ['websocket'] });
                        setSocket(newSocket);
                        console.log('Setting up socket listeners');

                        newSocket.on('connect', () => {
                            console.log('Connected to server');
                        });

                        newSocket.emit('register', response.data.user.username);

                        newSocket.on('message', data => {
                            console.log(data);
                            setPrintMessage(prevMessages => [...prevMessages, data]);
                        });

                        // Cleanup function for effect
                        return () => {
                            console.log('Cleaning up socket');
                            newSocket.disconnect();
                        };
                    }
                } else {
                    setLoginStatus('');
                    setIsLoggedIn(false);
                }
            })
            .catch(error => {
                console.error('Error checking login status:', error);
            });

        // Cleanup for the useEffect hook
        return () => {
            isMounted = false;
            console.log('Cleaning up effect');
        };
    }, []);

    const checkMessage = (data) => {
        if(data) {
            return checkLast(data)
        }

        else {
            return false
        }
    }

    const checkLast = data => {
        return data[data.length-1]
    }

    useEffect(() => {
        const fetchReceivers = async () => {
            if (username) {
                try {
                    const response = await axios.get(`${SERVER_URL}/api/receivers/${username}`);
                    const data = response.data;

                    if(data) {
                        const processedreceivers = data.map(receiver => ({
                            id: receiver.id,
                            username: receiver.username,
                            lastMessage: checkMessage(receiver.messages)
                        }))
                        
                        setReceivers(processedreceivers)
                        console.log(processedreceivers)
                    }
                } catch (error) {
                    console.error('Error fetching receivers:', error);
                }
            }
        };

        fetchReceivers();
    }, [username]);

    useEffect(() => {
        const fetchMessages = async () => {
            if (username && selectedReceiver) {
                try {
                    const receiver = typeof selectedReceiver === 'string' ? selectedReceiver : selectedReceiver.username;
                    const response = await axios.get(`${SERVER_URL}/api/receivers/${username}/${receiver}`);
                    
                    const { userFrom } = response.data;
                    
                    // If no messages key is present, default to an empty array
                    const messages = userFrom.messages || [];
                    
                    const processedMessages = messages.map(message => ({
                        text: message.send || message.receive,
                        time: message.time,
                        isSender: !!message.send
                    }));
                    
                    setPrintMessage(processedMessages);
                } catch (error) {
                    console.error('Error fetching messages:', error);
                }
            }
        };
        
        fetchMessages();
    }, [username, selectedReceiver]);

    const handleLogout = () => {
        axios.post(`${SERVER_URL}/logout`)
            .then(response => {
                if (response.status === 200) {
                    setLoginStatus('');
                    setIsLoggedIn(false);

                    if (socket) {
                        socket.disconnect();
                    }
                }
            })
            .catch(error => {
                console.error('Error logging out:', error);
            });
    };

    const handleLoginRedirect = () => {
        navigate('/login');
    };

    useEffect(() => {
        const fetchAllUser = async() => {
            const receiverUsername = receivers.map(receiver => receiver.username)

            if(!receivers) {
                const response = await axios.get(`${SERVER_URL}/search?username=${username}`);
                setResults(response.data)
                console.log(response.data)
                console.log('woi')
            }

            else {
                try {
                    const response = await axios.get(`${SERVER_URL}/search?username=${loginStatus}&receiver=${encodeURIComponent(JSON.stringify(receiverUsername))}`);
                    setResults(response.data)
                    console.log(response.data)
                  }
                  
                catch (error) {
                console.error('Error fetching search results:', error);
                }
            }
        }   
    
        fetchAllUser()
      }, [username, receivers])

  const handleSearch = async (e) => {
    const receiverUsername = receivers.map(receiver => receiver.username)

    if(query) {
        e.preventDefault()
        try {
            const response = await axios.get(`${SERVER_URL}/search?q=${query}&username=${username}&receiver=${encodeURIComponent(JSON.stringify(receiverUsername))}`);
            setResults(response.data)
            console.log(response.data)
          }
          
          catch (error) {
            console.error('Error fetching search results:', error);
          }
    }
  };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (selectedReceiver) {
            socket.emit('chat message', {
                to: selectedReceiver.username,
                text: message,
                from: username, // Add the sender's username
                time: formatTime(new Date())
            });
            setPrintMessage(prevMessages => [...prevMessages, { text: message, time: formatTime(new Date()), sender: username }]);
            setMessage('');
        }
    };

    const handleAdd = (usernameTo, id) => {
        console.log(`username: ${username}, id: ${id}`)
        const value = {
            username,
            idUser,
            usernameTo,
            id
        }

        axios.post(`${SERVER_URL}/api/receivers`, value)
        .then(res => {
            console.log(res)
        })
        .catch(err => {
            console.error('failed to add: ',err)
        });

        window.location.reload();
    }

    return (
        <>
            <Header 
                isLoggedIn={isLoggedIn} 
                handleLogout={handleLogout} 
                handleLoginRedirect={handleLoginRedirect} 
                loginStatus={loginStatus} 
            />
            <div className="container-wrapper">
                <Leftcontainer 
                    isLoggedIn={isLoggedIn}
                    receivers={receivers} 
                    onSelectReceiver={setSelectedReceiver} 
                    isSquare={isSquare}
                    toggleShape={toggleShape}
                    handleSearch={handleSearch}
                    setQuery={setQuery}
                    results={results}
                />
                <RightContainer 
                    selectedReceiver={selectedReceiver} 
                    isLoggedIn={isLoggedIn} 
                    handleSubmit={handleSubmit} 
                    setMessage={setMessage} 
                    message={message}
                    printMessage={printMessage} 
                    username={username} // Pass username to determine bubble type
                />
            </div>
            <FooterBox handleSearch={handleSearch}
            setQuery={setQuery} results={results}
            toggleShape={toggleShape}
            isSquare={isSquare}
            isLoggedIn={isLoggedIn}
            handleAdd={handleAdd}
            />
        </>
    );
}

const Header = ({ isLoggedIn, handleLogout, handleLoginRedirect, loginStatus }) => {
    return (
        <div className="headerChat">
            <h1>ChatApp</h1>
            <div className="componentChat">
                {isLoggedIn ? (
                    <>
                        <p>{loginStatus}</p>
                    </>
                ) : ('')}
                <div className="msgwithnum">
                    <span className='quantity-badge'>1</span>
                    <MessageSquare className='iconMessage' />
                </div>
                {isLoggedIn ? (
                    <LogOut className='iconMenu' onClick={handleLogout} />
                ): (
                    <LogIn className='iconMenu' onClick={handleLoginRedirect} />
                )}
            </div>
        </div>
    );
};

const Leftcontainer = ({ isLoggedIn, receivers, onSelectReceiver }) => {
    return (
        <div className="leftContainer">
            <form className='FormLeftContainer'>
                <div className="searchIcon">
                    <Search size={20} />
                </div>
                <input type="text" placeholder='Search' />
            </form>
            <div className="scroll-box">
                <div className="scroll-inner">
                    {isLoggedIn ? (
                        receivers.length > 0 ? (
                            <div>
                                {receivers.map(receiver => (
                                    <ReceiverOption
                                        key={receiver.id}
                                        username={receiver.username}
                                        lastMessage={receiver.lastMessage}
                                        onClick={() => onSelectReceiver(receiver)}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className='ifNo'>
                                <p>Request a friend to start</p>
                            </div>
                        )
                    ) : ('')}
                </div>
            </div>
        </div>
    );
};

const FooterBox = ({ handleSearch, setQuery, results, toggleShape, isSquare, isLoggedIn, handleAdd }) => {
    return(
        <>
            {isLoggedIn ? (
                <>
            <div className="addButton" onClick={toggleShape}>
                <div className="iconPluseMsg">
                    <Plus size={20} className='plus'/>
                    <MessageSquare size={35} />
                </div>
            </div>
            <div className={`box${isSquare ? ' show' : ''}`}>
                <div className="box-content">
                    <div className="formInput">
                        <form action="" onSubmit={handleSearch}>
                            <Search size={20}/>
                            <input type="text" autoFocus placeholder='Search..' 
                            onChange={(e) => setQuery(e.target.value)} />
                            <X size={20}/>
                        </form>
                    </div>
                    <div className="displayInput">
                        <div className="scroll-box2">
                            {results.length > 0 ? (
                                results.map((result, index) => (
                                    <InDisplayBox key={index}
                                    result={result}
                                    handleAdd={handleAdd}/>
                                ))
                            ) : (
                                <>
                                <p>Not avaible</p>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
                </>
            ): ''}
        </>
    )
}

const InDisplayBox = ({ result, handleAdd }) => {
    return(
    <div className="displaySearch">
        <User />
        <h3>{result.username}</h3>
        <button onClick={() => handleAdd(result.username, result.id)}>Add</button>
    </div>
    )
}

const ReceiverOption = ({ username, onClick, lastMessage }) => {
    return (
        <div className="content" onClick={onClick}>
            <div className="icon">
                <User size={40} className='userIcon' />
            </div>
            <div className="flex-container">
                <div className="info">
                    <h3>{username}</h3>
                    <p className='truncate'><strong>{
                        lastMessage != null ? (
                            <>
                            {lastMessage.send ? 'You: ' : ''}
                            </>
                        ): ('')
                    }</strong>{lastMessage.send || lastMessage.receive}</p>
                </div>
            </div>
        </div>
    );
};

const RightContainer = ({ selectedReceiver, isLoggedIn, handleSubmit, setMessage, message, printMessage, username }) => {
    return (
        <div className="rightContainer">
            <MessageContent 
                receiver={selectedReceiver} 
                isLoggedIn={isLoggedIn} 
                handleSubmit={handleSubmit} 
                setMessage={setMessage} 
                message={message} 
                printMessage={printMessage}
                username={username} // Pass username to determine bubble type
            />
        </div>
    );
};

const MessageContent = ({ receiver, isLoggedIn, handleSubmit, setMessage, message, printMessage, username }) => {
    return (
        <div className="content">
            {isLoggedIn ? (
                receiver ? (
                    <>
                        <HeadMessage receiver={receiver} />
                        <MiddleMessage 
                            printMessage={printMessage} 
                            username={username} // Pass username to Bubble
                        />
                        <FooterMessage 
                            handleSubmit={handleSubmit} 
                            setMessage={setMessage} 
                            message={message} 
                        />
                    </>
                ) : (
                    <div className='ifNo'>
                        <p>Please select a receiver to start chatting.</p>
                    </div>
                )
            ) : (
                <div className="ifNo">
                    <p>Login to start</p>
                </div>
            )}
        </div>
    );
};

const HeadMessage = ({ receiver }) => {
    return (
        <div className="headMessage">
            <div className="icon">
                <User size={35} className='userIcon' />
            </div>
            <h3>{receiver.username}</h3>
        </div>
    );
};

const MiddleMessage = ({ printMessage, username }) => {
    const chatContainerRef = useRef(null);

    useEffect(() => {
        // Scroll to the bottom of the chat container when messages change
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [printMessage]);

    return (
        <div className="chat-container" ref={chatContainerRef}>
            <div className="container-content">
                {printMessage.map((msg, index) => (
                    <Bubble 
                        key={index} // Use index or a unique id if available
                        message={msg}
                        isSender={(msg.sender === username) || msg.isSender} // Determine if the message is from the current user
                    />
                ))}
            </div>
        </div>
    );
};

const Bubble = ({ message, isSender }) => {
    return (
        <div className={`bubble ${isSender ? 'sender' : 'receiver'}`}>
            <p>{message.text}</p>
            <div className="timestamp">{message.time}</div>
        </div>
    );
};

const FooterMessage = ({ handleSubmit, setMessage, message }) => {
    return (
        <div className="footer">
            <form onSubmit={handleSubmit}>
                <input 
                    type="text"
                    placeholder='Message'
                    autoFocus
                    value={message}
                    onChange={(e) => setMessage(e.target.value)} 
                />
                <div className="btn">
                    <button type="submit"><Send /></button>
                </div>
            </form>
        </div>
    );
};

export default Chat;
