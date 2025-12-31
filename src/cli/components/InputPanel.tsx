import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import type { AgentState } from "../types";

interface InputPanelProps {
  state: AgentState;
  onSubmit: (input: string) => void;
}

export const InputPanel: React.FC<InputPanelProps> = ({ state, onSubmit }) => {
  const [value, setValue] = useState("");

  const getPromptLabel = () => {
    return state === "idle" || state === "completed" ? "Goal: " : "Hint: ";
  };

  const getPromptColor = () => {
    return state === "idle" || state === "completed" ? "green" : "yellow";
  };

  const handleSubmit = () => {
    if (value.trim()) {
      onSubmit(value.trim());
      setValue("");
    }
  };

  return (
    <Box borderStyle="single" paddingX={1} flexDirection="column">
      <Box>
        <Text color={getPromptColor()} bold>
          {getPromptLabel()}
        </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={handleSubmit}
          placeholder={
            state === "idle" || state === "completed"
              ? "実行したいタスクを入力してください..."
              : "追加のヒントを入力..."
          }
        />
      </Box>
      <Box marginTop={1}>
        <Text dimColor>
          {state === "idle" || state === "completed"
            ? "Enterキーで実行開始"
            : "実行中にヒントを入力できます"}
        </Text>
      </Box>
    </Box>
  );
};
