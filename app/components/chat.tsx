"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";
import zod from "zod";
import { AiLoading } from "./AiLoading";

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
  ) => Promise<ChatMessage[] | undefined>;
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

function invokePromptStream(
  messages: ChatMessage[],
  onText: (text: string) => void,
) {
  return fetch(`/api/langtail/stream`, {
    method: "POST",
    body: JSON.stringify({ messages }),
    headers: {
      "Content-Type": "application/json",
    },
  }).then(async (res) => {
    const reader = res.body?.pipeThrough(new TextDecoderStream()).getReader();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        value
          .split("\n")
          .filter(Boolean)
          .map((v) => {
            try {
              return JSON.parse(v).choices[0]?.delta?.content;
            } catch (e) {
              return "";
            }
          })
          .filter(Boolean)
          .forEach(onText);
      }
    }
  });
}

export type ChatMessage = AIData["choices"][number]["message"];

const Chat = ({
  functionCallHandler, // default to return empty string
}: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [generatingResponse, setGeneratingResponse] = useState<boolean>(false);
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

  const appendToTheLastMessage = (messageDelta) => {
    const lastMessage = messageRef.current[messageRef.current.length - 1];
    lastMessage.content =
      lastMessage.content === "…" ? "" : lastMessage.content;

    lastMessage.content += messageDelta;
    setMessages([...messageRef.current]);
    return messageRef.current;
  };

  const handleMessagAiMessages = (aiData: AIData) => {
    const latestChoice = aiData.choices[aiData.choices.length - 1];
    if (latestChoice?.finish_reason === "tool_calls") {
      functionCallHandler?.(latestChoice.message).then((toolMessages) => {
        if (toolMessages) {
          const currentMessages = appendMessages([
            latestChoice.message,
            ...toolMessages,
            {
              role: "assistant",
              content: "",
            },
          ]);

          invokePromptStream(currentMessages, (messageDelta) => {
            setGeneratingResponse(false);
            appendToTheLastMessage(messageDelta);
          }).then(() => {
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
    setGeneratingResponse(true);

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
    setGeneratingResponse(false);
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {messages
          .filter((msg) => msg.content)
          .map((msg, index) => (
            <Message key={index} role={msg.role} content={msg.content} />
          ))}
        {generatingResponse && <AiLoading />}
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
