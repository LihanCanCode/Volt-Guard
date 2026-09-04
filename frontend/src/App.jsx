import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Monitor from "./pages/Monitor";
import History from "./pages/History";
import CaregiverView from "./pages/CaregiverView";
import Contacts from "./pages/Contacts";
import "./App.css";

export default function App() {
  return (
    <BrowserRouter>
      <nav className="nav">
        <NavLink to="/" end>
          Monitor
        </NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/caregiver">Caregiver View</NavLink>
        <NavLink to="/contacts">Contacts</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Monitor />} />
        <Route path="/history" element={<History />} />
        <Route path="/caregiver" element={<CaregiverView />} />
        <Route path="/contacts" element={<Contacts />} />
      </Routes>
    </BrowserRouter>
  );
}
