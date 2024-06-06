"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";
import zod, { set } from "zod";

const aiDataSchema = zod.object({
  id: zod.string(),
  choices: zod.array(
    zod.object({
      finish_reason: zod.string(),
      message: zod.object({
        content: zod.string().nullable(),
        role: zod.string(),
        tool_calls: zod
          .array(
            zod.object({
              function: zod.object({
                name: zod.string(),
                arguments: zod.string(),
              }),
              id: zod.string(),
              type: zod.string(),
            }),
          )
          .optional(),
      }),
    }),
  ),
});

type AIData = zod.infer<typeof aiDataSchema>;

type MessageProps = {
  role: "user" | "assistant" | "code";
  text: string;
};

const UserMessage = ({ text }: { text: string }) => {
  return <div className={styles.userMessage}>{text}</div>;
};

const AssistantMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
    </div>
  );
};

const CodeMessage = ({ text }: { text: string }) => {
  return (
    <div className={styles.codeMessage}>
      {text.split("\n").map((line, index) => (
        <div key={index}>
          <span>{`${index + 1}. `}</span>
          {line}
        </div>
      ))}
    </div>
  );
};

const Message = ({ role, text }: MessageProps) => {
  switch (role) {
    case "user":
      return <UserMessage text={text} />;
    case "assistant":
      return <AssistantMessage text={text} />;
    case "code":
      return <CodeMessage text={text} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (toolCall: AIData["choices"][number]) => Promise<{
    role: "tool";
    tool_call_id: string;
    content: string;
  }>;
};

function invokePrompt(
  messages: { role: "user" | "tool" | "assistent"; content: string }[],
) {
  return fetch(
    `/api/langtail?${new URLSearchParams({
      prompt: "weather",
      messages: JSON.stringify(messages),
    })}`,
    {
      method: "GET",
    },
  )
    .then((res) => res.json())
    .then((rawAiData) => {
      console.log("rawAiData", rawAiData);
      return aiDataSchema.parse(rawAiData);
    });
}

type ChatMessage = {
  role: "user" | "assistant" | "tool";
  content: string;
};

const Chat = ({
  functionCallHandler, // default to return empty string
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleMessagAiMessages = async (aiData: AIData) => {
    console.log("ai data", aiData);

    const latestChoice = aiData.choices[aiData.choices.length - 1];
    if (latestChoice?.finish_reason === "tool_calls") {
      console.log("bum", latestChoice);
      await functionCallHandler?.(latestChoice).then((toolMessage) => {
        console.log("bum resolved", toolMessage);
        if (toolMessage) {
          const nextMessages = [...messages, latestChoice.message, toolMessage];
          invokePrompt(nextMessages).then((toolResultAiData) => {
            handleMessagAiMessages(toolResultAiData);
          });
          return nextMessages;
        }
      });
    }

    if (latestChoice?.finish_reason === "stop") {
      setMessages((prevMessages) => {
        return [...prevMessages, latestChoice.message];
      });
    }

    handleRunCompleted();
  };

  console.log("messages", messages);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;
    setMessages((prevMessages) => {
      const nextMessages = [
        ...messages,
        { role: "user" as const, content: userInput },
      ];

      invokePrompt(nextMessages).then((aiData) => {
        handleMessagAiMessages(aiData);
      });

      return nextMessages;
    });

    setUserInput("");
    setInputDisabled(true);
    scrollToBottom();
  };

  // handleRunCompleted - re-enable the input form
  const handleRunCompleted = () => {
    setInputDisabled(false);
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {messages
          .filter((msg) => msg.content)
          .map((msg, index) => (
            <Message key={index} role={msg.role} text={msg.content} />
          ))}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className={`${styles.inputForm} ${styles.clearfix}`}
      >
        <input
          type="text"
          className={styles.input}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter your question"
        />
        <button
          type="submit"
          className={styles.button}
          disabled={inputDisabled}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
