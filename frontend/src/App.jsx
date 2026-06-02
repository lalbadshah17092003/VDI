import React from "react";
import { Routes, Route } from "react-router-dom";
import "./App.css";
import FrontPage from "./FrontPage";


function App() {

  return (
    <div className="App">
    
      <Routes>
      
        <Route
          path="/"
          element={
              <FrontPage/>
          }
        />
      </Routes>
      
    </div>
  );
}
export default App;

