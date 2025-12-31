import React from "react";
import { Box, Text } from "ink";
import type { AgentStatus } from "../types";

interface StatusBarProps {
  status: AgentStatus;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status }) => {
  const getStatusColor = () => {
    switch (status.state) {
      case "idle":
        return "gray";
      case "running":
        return "blue";
      case "completed":
        return "green";
      case "error":
        return "red";
      default:
        return "white";
    }
  };

  const getStatusText = () => {
    switch (status.state) {
      case "idle":
        return "Idle";
      case "running":
        return "Running";
      case "completed":
        return "Completed";
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  return (
    <Box borderStyle="single" paddingX={1}>
      <Text>
        Step:{" "}
        <Text bold>
          {status.currentStep}/{status.maxSteps}
        </Text>
        {" | "}
        Status:{" "}
        <Text color={getStatusColor()} bold>
          {getStatusText()}
        </Text>
        {status.currentGoal && (
          <>
            {" | "}
            Goal:{" "}
            <Text dimColor>
              {status.currentGoal.slice(0, 50)}
              {status.currentGoal.length > 50 ? "..." : ""}
            </Text>
          </>
        )}
      </Text>
    </Box>
  );
};
