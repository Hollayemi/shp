"use client"

import React, { useState } from "react";
import { PreviewErrorScreen } from "./components/PreviewErrorScreen";

const App: React.FC = () => {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    // Simulate a refresh delay if needed, or just reload
    try {
      // In a real app this might trigger a prop or context action
      // For this template, we'll simulate a wait then reload or just reload
      await new Promise((resolve) => setTimeout(resolve, 1000));
      window.location.reload();
    } catch (e) {
      console.error(e);
      setIsRefreshing(false);
    }
  };

  const handleContactSupport = () => {
    // Stub for support contact
    console.log("Contact support requested");
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <PreviewErrorScreen
        onRefresh={handleRefresh}
        onContactSupport={handleContactSupport}
        isRefreshing={isRefreshing}
      />
    </div>
  );
};

export default App;
