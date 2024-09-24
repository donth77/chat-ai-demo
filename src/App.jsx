import { useState, useEffect } from "react";
import OpenAI from "openai";
import localforage from "localforage";
import { v4 as uuidv4 } from "uuid";
import { marked } from "marked";
import parse from "html-react-parser";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faMessage } from "@fortawesome/free-regular-svg-icons";
import { faPaperPlane, faPlus } from "@fortawesome/free-solid-svg-icons";
import Logo from "./assets/logo.svg?react";
import { BallTriangle } from "react-loader-spinner";
import "./App.css";

const openai = new OpenAI({
  apiKey: import.meta.env.VITE_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true,
});

localforage.config({ name: "Chat AI App" });

function App() {
  const [inputTxt, setInputTxt] = useState("");
  const [history, setHistory] = useState([]);
  const [isLoading, setLoading] = useState(false);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [allConvs, setAllConvs] = useState([]);

  async function sendMessage(content) {
    const userMessage = {
      role: "user",
      content,
      formattedContent: content,
    };

    setHistory((prevHistory) => [...prevHistory, userMessage]);
    setLoading(true);

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [...history, userMessage],
      });

      console.log(completion);

      const assistantMessage = {
        ...completion.choices[0].message,
        formattedContent: await marked(completion.choices[0].message.content),
      };
      setHistory((prevHistory) => [...prevHistory, assistantMessage]);

      if (!currentConvId) {
        // Create new conversation
        const newConvId = uuidv4();
        const newConv = {
          history: [userMessage, assistantMessage],
          createdTime: new Date().toISOString(),
        };

        localforage.setItem(newConvId, newConv);

        setCurrentConvId(newConvId);
        setAllConvs([{ id: newConvId, ...newConv }, ...allConvs]);
      } else {
        // Update existing conversation
        const conv = await localforage.getItem(currentConvId);
        localforage.setItem(currentConvId, {
          ...conv,
          history: [...conv.history, userMessage, assistantMessage],
        });
      }
    } catch (error) {
      console.error(error);
    }

    setLoading(false);
  }

  function handleSendMessage() {
    sendMessage(inputTxt);
    setInputTxt("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter") {
      handleSendMessage();
    }
  }

  async function loadConvsInCreatedOrder() {
    try {
      const allKeys = await localforage.keys();

      const result = [];
      for (const key of allKeys) {
        const conv = await localforage.getItem(key);
        result.push({
          id: key,
          ...conv,
        });
      }

      result.sort((a, b) => new Date(b.createdTime) - new Date(a.createdTime));

      setAllConvs(result);
    } catch (err) {
      console.error(err);
    }
  }

  useEffect(() => {
    loadConvsInCreatedOrder();
  }, []);

  return (
    <>
      <aside className="sidebar">
        <div className="sidebar-container">
          <span className="sidebar-logo">
            <Logo /> <h1>Chat AI</h1>
          </span>
          <div className="chat-history">
            <h3>Chats</h3>
            {allConvs.map((conv, index) => (
              <span
                className="chat-history-item"
                key={index}
                onClick={() => {
                  setCurrentConvId(conv.id);
                  setHistory(conv.history);
                  setInputTxt("");
                }}
              >
                <FontAwesomeIcon icon={faMessage} />
                <span className="chat-history-item-text">
                  {conv.history[0].content}
                </span>
              </span>
            ))}
          </div>
        </div>

        <button
          className="new-chat-btn"
          onClick={() => {
            setCurrentConvId(null);
            setHistory([]);
            setInputTxt("");
          }}
        >
          <FontAwesomeIcon icon={faPlus} />
          Start new chat
        </button>
      </aside>
      <main className="content">
        <div className="chat">
          {history.map((msg, index) => (
            <div key={index} className={`message ${msg.role}`}>
              {msg.role === "assistant" && (
                <span className="logo">
                  <Logo />
                </span>
              )}
              <div>{parse(msg.formattedContent)}</div>
            </div>
          ))}
          {isLoading && (
            <div className="message assistant">
              <span className="logo">
                <Logo />
              </span>
              <BallTriangle
                height={24}
                width={24}
                radius={5}
                color="#4338ca"
                ariaLabel="ball-triangle-loading"
                wrapperStyle={{}}
                wrapperClass=""
                visible={true}
              />
            </div>
          )}
        </div>
        <div className="input-bar">
          <input
            type="text"
            onKeyDown={handleKeyDown}
            value={inputTxt}
            onChange={(event) => {
              setInputTxt(event.target.value);
            }}
          />
          <button onClick={handleSendMessage}>
            <FontAwesomeIcon icon={faPaperPlane} /> Submit
          </button>
        </div>
      </main>
    </>
  );
}

export default App;
