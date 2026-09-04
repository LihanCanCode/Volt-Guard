import { io } from "socket.io-client";

// Same-origin: Vite's dev proxy forwards /socket.io to the backend, so this
// works whether the page was opened as localhost or through an ngrok/LAN URL.
export const socket = io({ autoConnect: false });
