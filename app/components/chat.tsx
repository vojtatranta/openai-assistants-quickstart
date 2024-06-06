"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";
import zod from "zod";

const aiDataSchema = zod.object({
  id: zod.string(),
  choices: zod.array(
    zod.object({
      finish_reason: zod.string(),
      message: zod.object({
        content: zod.string().nullable(),
        role: zod.enum(["user", "assistant", "tool"]),
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

const UserMessage = ({ text }: { text: string | null }) => {
  return <div className={styles.userMessage}>{text}</div>;
};

const AssistantMessage = ({ text }: { text: string | null }) => {
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
    </div>
  );
};

const Message = ({ role, content }: ChatMessage) => {
  switch (role) {
    case "user":
      return <UserMessage text={content} />;
    case "assistant":
      return <AssistantMessage text={content} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: ChatMessage,
  ) => Promise<ChatMessage | undefined>;
};

function invokePrompt(messages: ChatMessage[]) {
  return fetch(`/api/langtail`, {
    method: "POST",
    body: JSON.stringify({ messages }),
    headers: {
      "Content-Type": "application/json",
    },
  })
    .then((res) => res.json())
    .then((rawAiData) => aiDataSchema.parse(rawAiData));
}

export type ChatMessage = AIData["choices"][number]["message"];

const Chat = ({
  functionCallHandler, // default to return empty string
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messageRef = useRef<ChatMessage[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const appendMessages = (newMessages: ChatMessage[]) => {
    messageRef.current = [...messageRef.current, ...newMessages];
    setMessages([...messageRef.current]);

    return messageRef.current;
  };

  const handleMessagAiMessages = (aiData: AIData) => {
    const latestChoice = aiData.choices[aiData.choices.length - 1];
    if (latestChoice?.finish_reason === "tool_calls") {
      functionCallHandler?.(latestChoice.message).then((toolMessage) => {
        if (toolMessage) {
          const currentMessages = appendMessages([
            latestChoice.message,
            toolMessage,
          ]);
          invokePrompt(currentMessages).then((toolResultAiData) => {
            handleMessagAiMessages(toolResultAiData);
            handleRunCompleted();
          });
        }
      });
    }

    if (latestChoice?.finish_reason === "stop") {
      appendMessages([latestChoice.message]);
      handleRunCompleted();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() || inputDisabled) return;

    invokePrompt(
      appendMessages([{ role: "user" as const, content: userInput }]),
    ).then((aiData) => {
      handleMessagAiMessages(aiData);
    });

    setUserInput("");
    setInputDisabled(true);
    scrollToBottom();
  };

  const handleRunCompleted = () => {
    setInputDisabled(false);
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {messages
          .filter((msg) => msg.content)
          .map((msg, index) => (
            <Message key={index} role={msg.role} content={msg.content} />
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
