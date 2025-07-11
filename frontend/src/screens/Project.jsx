import React, { useState, useEffect, useContext, useRef } from 'react'
import { UserContext } from '../context/user.context'
import { useNavigate, useLocation } from 'react-router-dom'
import axios from '../config/axios'
import { initializeSocket, receiveMessage, sendMessage } from '../config/socket'
import Markdown from 'markdown-to-jsx'
import hljs from 'highlight.js';
import { getWebContainer } from '../config/webcontainer'


function SyntaxHighlightedCode(props) {
    const ref = useRef(null)

    React.useEffect(() => {
        if (ref.current && props.className?.includes('lang-') && window.hljs) {
            window.hljs.highlightElement(ref.current)

            // hljs won't reprocess the element unless this attribute is removed
            ref.current.removeAttribute('data-highlighted')
        }
    }, [props.className, props.children])

    return <code {...props} ref={ref} />
}


const Project = () => {

    const location = useLocation()

    const [isSidePanelOpen, setIsSidePanelOpen] = useState(false)
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedUserId, setSelectedUserId] = useState(new Set()) // Initialized as Set
    const [project, setProject] = useState(location.state?.project || {})
    const [message, setMessage] = useState('')
    const { user } = useContext(UserContext)
    const messageBox = React.createRef()

    const [users, setUsers] = useState([])
    const [messages, setMessages] = useState([]) // New state variable for messages
    const [fileTree, setFileTree] = useState({
        'index.html': {
            file: {
                contents: '<!DOCTYPE html>\n<html>\n<head>\n    <title>My Project</title>\n</head>\n<body>\n    <h1>Hello World!</h1>\n    <script src="script.js"></script>\n</body>\n</html>'
            }
        },
        'script.js': {
            file: {
                contents: 'console.log("Hello from JavaScript!");'
            }
        },
        'server.js': {
            file: {
                contents: `const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(process.cwd(), filePath);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css'
        }[ext] || 'text/plain';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/');
});`
            }
        }
    })

    const [currentFile, setCurrentFile] = useState('index.html')
    const [openFiles, setOpenFiles] = useState(['index.html'])

    const [webContainer, setWebContainer] = useState(null)
    const [iframeUrl, setIframeUrl] = useState(null)

    const [runProcess, setRunProcess] = useState(null)

    const handleUserClick = (id) => {
        setSelectedUserId(prevSelectedUserId => {
            const newSelectedUserId = new Set(prevSelectedUserId);
            if (newSelectedUserId.has(id)) {
                newSelectedUserId.delete(id);
            } else {
                newSelectedUserId.add(id);
            }

            return newSelectedUserId;
        });


    }


    function addCollaborators() {

        axios.put("/projects/add-user", {
            projectId: location.state.project._id,
            users: Array.from(selectedUserId)
        }).then(res => {
            console.log(res.data)
            setIsModalOpen(false)

        }).catch(err => {
            console.log(err)
        })

    }

    const send = () => {
        console.log("Sending message:", message)

        sendMessage('project-message', {
            message,
            sender: user
        })
        setMessages(prevMessages => [...prevMessages, { sender: user, message }]) // Update messages state
        setMessage("")

    }

    function WriteAiMessage(message) {
        let messageObject;
        if (typeof message === 'string') {
            try {
                messageObject = JSON.parse(message);
            } catch {
                messageObject = { text: message };
            }
        } else {
            messageObject = message;
        }

        return (
            <div className='overflow-auto bg-slate-950 text-white rounded-sm p-2 space-y-2'>
                {messageObject.text && (
                    <Markdown
                        children={messageObject.text}
                        options={{
                            overrides: {
                                code: SyntaxHighlightedCode,
                            },
                        }}
                    />
                )}
                {messageObject.html && (
                    <Markdown
                        children={`   html\n${messageObject.html}\n   }`.replace(/\u0000/g, '`')}
                        options={{
                            overrides: {
                                code: SyntaxHighlightedCode,
                            },
                        }}
                    />
                )}
            </div>
        );
    }

    useEffect(() => {
        console.log("Project component mounted, project:", project)
        console.log("Current fileTree:", fileTree)

        if (project._id) {
            try {
                initializeSocket(project._id)
            } catch (error) {
                console.error("Failed to initialize socket:", error)
            }
        }

        if (!webContainer) {
            getWebContainer().then(container => {
                setWebContainer(container)
                console.log("container started")
            }).catch(error => {
                console.error("Failed to initialize WebContainer:", error)
            })
        }


        receiveMessage('project-message', data => {

            console.log(data)

            if (data.sender._id == 'ai') {
                let message;
                if (typeof data.message === 'string') {
                    try {
                        message = JSON.parse(data.message);
                    } catch {
                        message = { text: data.message };
                    }
                } else {
                    message = data.message;
                }

                console.log(message);

                if (message.fileTree && typeof message.fileTree === 'object') {
                    webContainer?.mount(message.fileTree);
                    let ft = message.fileTree;
                    if (!ft['server.js']) {
                        ft['server.js'] = {
                            file: {
                                contents: `const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(process.cwd(), filePath);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css'
        }[ext] || 'text/plain';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/');
});`
                            }
                        };
                    }
                    setFileTree(ft);
                    setMessages(prevMessages => [...prevMessages, data]);
                } else {
                    // No fileTree, just add the message
                    setMessages(prevMessages => [...prevMessages, data]);
                }
            } else {
                setMessages(prevMessages => [...prevMessages, data]);
            }
        })


        if (location.state?.project?._id) {
            axios.get(`/projects/get-project/${location.state.project._id}`).then(res => {

                console.log(res.data.project)

                setProject(res.data.project)
                let ft = res.data.project.fileTree || {};
                if (!ft['server.js']) {
                    ft['server.js'] = {
                        file: {
                            contents: `const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
    let filePath = req.url === '/' ? '/index.html' : req.url;
    filePath = path.join(process.cwd(), filePath);
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const ext = path.extname(filePath);
        const contentType = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css'
        }[ext] || 'text/plain';
        
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
});

server.listen(3000, () => {
    console.log('Server running at http://localhost:3000/');
});`
                        }
                    };
                }
                setFileTree(ft)
            }).catch(err => {
                console.error("Failed to fetch project:", err)
            })
        }

        axios.get('/users/all').then(res => {

            setUsers(res.data.users)

        }).catch(err => {

            console.log(err)

        })

    }, [])

    function saveFileTree(ft) {
        axios.put('/projects/update-file-tree', {
            projectId: project._id,
            fileTree: ft
        }).then(res => {
            console.log(res.data)
        }).catch(err => {
            console.log(err)
        })
    }


    // Removed appendIncomingMessage and appendOutgoingMessage functions

    function scrollToBottom() {
        messageBox.current.scrollTop = messageBox.current.scrollHeight
    }

    if (!project._id) {
        return (
            <div className="h-screen w-screen flex items-center justify-center">
                <p className="text-gray-500">No project data available. Please go back and select a project.</p>
            </div>
        )
    }

    return (
        <main className='h-screen w-screen flex bg-gradient-to-br from-slate-200 to-slate-400'>
            <section className="left relative flex flex-col h-screen min-w-96 bg-slate-300 shadow-lg">
                <header className='flex justify-between items-center p-2 px-4 w-full bg-slate-100 absolute z-10 top-0 shadow-md'>
                    <button className='flex gap-2 hover:bg-slate-200 transition rounded px-2 py-1' onClick={() => setIsModalOpen(true)}>
                        <i className="ri-add-fill mr-1"></i>
                        <p>Add collaborator</p>
                    </button>
                    <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2 hover:bg-slate-200 transition rounded'>
                        <i className="ri-group-fill"></i>
                    </button>
                </header>
                <div className="conversation-area pt-14 pb-10 flex-grow flex flex-col h-full relative">

                    <div
                        ref={messageBox}
                        className="message-box p-1 flex-grow flex flex-col gap-2 overflow-auto max-h-full scrollbar-thin scrollbar-thumb-slate-400 scrollbar-track-slate-200 bg-slate-100/70 rounded-lg shadow-inner">
                        {messages.map((msg, index) => (
                            <div
                                key={`${msg.sender._id}-${index}`}
                                className={`message flex flex-col w-fit max-w-[80%] rounded-xl shadow-md p-2 mb-1 transition-all
                                    ${msg.sender._id === 'ai' ? 'bg-gradient-to-r from-indigo-500 to-blue-400 text-white self-start' : 'bg-white text-gray-900 self-end'}
                                    ${msg.sender._id == user._id.toString() && 'ml-auto'}
                                `}
                            >
                                <small className='opacity-65 text-xs mb-1'>{msg.sender.email}</small>
                                <div className='text-sm'>
                                    {msg.sender._id === 'ai' ?
                                        WriteAiMessage(msg.message)
                                        : <p>{msg.message}</p>}
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="inputField w-full flex absolute bottom-0 bg-slate-200/80 p-2 rounded-b-lg shadow-md">
                        <input
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            className='p-2 px-4 border border-slate-300 outline-none flex-grow rounded-l-lg focus:ring-2 focus:ring-blue-400 transition' type="text" placeholder='Enter message' />
                        <button
                            onClick={send}
                            className='px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-r-lg font-semibold transition'><i className="ri-send-plane-fill"></i></button>
                    </div>
                </div>
                <div className={`sidePanel w-full h-full flex flex-col gap-2 bg-slate-50 absolute transition-all ${isSidePanelOpen ? 'translate-x-0' : '-translate-x-full'} top-0`}>
                    <header className='flex justify-between items-center px-4 p-2 bg-slate-200'>

                        <h1
                            className='font-semibold text-lg'
                        >Collaborators</h1>

                        <button onClick={() => setIsSidePanelOpen(!isSidePanelOpen)} className='p-2'>
                            <i className="ri-close-fill"></i>
                        </button>
                    </header>
                    <div className="users flex flex-col gap-2">

                        {project.users && project.users.map(user => {
                            return (
                                <div key={user._id} className="user cursor-pointer hover:bg-slate-200 p-2 flex gap-2 items-center">
                                    <div className='aspect-square rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            )


                        })}
                    </div>
                </div>
            </section>

            <section className="right  bg-red-50 flex-grow h-full flex">

                <div className="explorer h-full max-w-64 min-w-52 bg-slate-200">
                    <div className="file-tree w-full">
                        {
                            Object.keys(fileTree).map((file) => (
                                <button key={file}

                                    onClick={() => {
                                        setCurrentFile(file)
                                        setOpenFiles([...new Set([...openFiles, file])])
                                    }}
                                    className="tree-element cursor-pointer p-2 px-4 flex items-center gap-2 bg-slate-300 w-full">
                                    <p
                                        className='font-semibold text-lg'
                                    >{file}</p>
                                </button>))

                        }
                    </div>

                </div>


                <div className="code-editor flex flex-col flex-grow h-full shrink">

                    <div className="top flex justify-between w-full">

                        <div className="files flex">
                            {
                                openFiles.map((file) => (
                                    <button key={file}

                                        onClick={() => setCurrentFile(file)}
                                        className={`open-file cursor-pointer p-2 px-4 flex items-center w-fit gap-2 bg-slate-300 ${currentFile === file ? 'bg-slate-400' : ''}`}>
                                        <p
                                            className='font-semibold text-lg'
                                        >{file}</p>
                                    </button>
                                ))
                            }
                        </div>

                        <div className="actions flex gap-2">
                            <button
                                onClick={async () => {
                                    try {
                                        console.log("Mounting fileTree to WebContainer...")
                                        console.log("FileTree to mount:", fileTree)
                                        await webContainer.mount(fileTree)
                                        
                                        // Wait a moment for mount to complete
                                        await new Promise(resolve => setTimeout(resolve, 1000))
                                        
                                        // Verify files are mounted
                                        const lsProcess = await webContainer.spawn("ls", ["-la"]);
                                        lsProcess.output.pipeTo(new WritableStream({
                                            write(chunk) {
                                                console.log("Directory contents:", chunk)
                                            }
                                        }))

                                        // Wait for ls to complete
                                        await new Promise((resolve) => {
                                            lsProcess.exit.then(() => resolve())
                                        })

                                        if (runProcess) {
                                            runProcess.kill()
                                        }

                                        console.log("Starting Node.js HTTP server...")
                                        let tempRunProcess = await webContainer.spawn("node", ["server.js"]);

                                        tempRunProcess.output.pipeTo(new WritableStream({
                                            write(chunk) {
                                                console.log("Server:", chunk)
                                            }
                                        }))

                                        setRunProcess(tempRunProcess)

                                        webContainer.on('server-ready', (port, url) => {
                                            console.log("Server ready on port:", port, "URL:", url)
                                            setIframeUrl(url)
                                        })

                                    } catch (error) {
                                        console.error("Failed to run project:", error)
                                        alert("Failed to run project. Check console for details.")
                                    }
                                }}
                                className='p-2 px-4 bg-slate-300 text-white hover:bg-slate-400'
                            >
                                Run
                            </button>


                        </div>
                    </div>
                    <div className="bottom flex flex-grow max-w-full shrink overflow-auto">
                        {
                            fileTree[currentFile] ? (
                                <div className="code-editor-area h-full overflow-auto flex-grow bg-slate-50">
                                    <pre className="hljs h-full m-0">
                                        <code
                                            className="hljs h-full outline-none block p-4"
                                            contentEditable
                                            suppressContentEditableWarning
                                            onBlur={(e) => {
                                                const updatedContent = e.target.innerText;
                                                const ft = {
                                                    ...fileTree,
                                                    [currentFile]: {
                                                        file: {
                                                            contents: updatedContent
                                                        }
                                                    }
                                                }
                                                setFileTree(ft)
                                                saveFileTree(ft)
                                            }}
                                            dangerouslySetInnerHTML={{ __html: hljs.highlight('javascript', fileTree[currentFile].file.contents).value }}
                                            style={{
                                                whiteSpace: 'pre-wrap',
                                                fontFamily: 'monospace',
                                                fontSize: '14px',
                                                lineHeight: '1.5',
                                            }}
                                        />
                                    </pre>
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full w-full bg-slate-50">
                                    <p className="text-gray-500">No file selected</p>
                                </div>
                            )
                        }
                    </div>

                </div>

                {iframeUrl && webContainer &&
                    (<div className="flex min-w-96 flex-col h-full">
                        <div className="address-bar">
                            <input type="text"
                                onChange={(e) => setIframeUrl(e.target.value)}
                                value={iframeUrl} className="w-full p-2 px-4 bg-slate-200" />
                        </div>
                        <iframe src={iframeUrl} className="w-full h-full"></iframe>
                    </div>)
                }


            </section>

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="bg-white p-4 rounded-md w-96 max-w-full relative">
                        <header className='flex justify-between items-center mb-4'>
                            <h2 className='text-xl font-semibold'>Select User</h2>
                            <button onClick={() => setIsModalOpen(false)} className='p-2'>
                                <i className="ri-close-fill"></i>
                            </button>
                        </header>
                        <div className="users-list flex flex-col gap-2 mb-16 max-h-96 overflow-auto">
                            {users.map(user => (
                                <div key={user._id} className={`user cursor-pointer hover:bg-slate-200 ${Array.from(selectedUserId).indexOf(user._id) != -1 ? 'bg-slate-200' : ""} p-2 flex gap-2 items-center`} onClick={() => handleUserClick(user._id)}>
                                    <div className='aspect-square relative rounded-full w-fit h-fit flex items-center justify-center p-5 text-white bg-slate-600'>
                                        <i className="ri-user-fill absolute"></i>
                                    </div>
                                    <h1 className='font-semibold text-lg'>{user.email}</h1>
                                </div>
                            ))}
                        </div>
                        <button
                            onClick={addCollaborators}
                            className='absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-blue-600 text-white rounded-md'>
                            Add Collaborators
                        </button>
                    </div>
                </div>
            )}
        </main>
    )
}

export default Project