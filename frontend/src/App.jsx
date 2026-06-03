import React from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import FrontPage from "./FrontPage";

// loader function for ads.txt
async function adsTxtLoader() {
  const text = `google.com, pub-9385539987256182, DIRECT, f08c47fec0942fa0`;
  return new Response(text, {
    headers: {
      'Content-Type': 'text/plain',
    },
  });
}

function App() {
  return (
    <div className="App">
      <Routes>
        <Route path="/" element={<FrontPage />} />
        <Route 
          path="/ads.txt" 
          loader={adsTxtLoader}
          element={<div />}
        />
      </Routes>
    </div>
  );
}

export default App;