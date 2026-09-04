import { useEffect, useState } from "react";

export default function Contacts() {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [relationship, setRelationship] = useState("");
  const [error, setError] = useState(null);

  const loadContacts = () => {
    setLoading(true);
    fetch("/api/contacts")
      .then((res) => res.json())
      .then(setContacts)
      .finally(() => setLoading(false));
  };

  useEffect(loadContacts, []);

  const addContact = async (e) => {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/contacts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, relationship }),
    });
    if (!res.ok) {
      setError("Could not add contact — name is required.");
      return;
    }
    setName("");
    setRelationship("");
    loadContacts();
  };

  const removeContact = async (id) => {
    await fetch(`/api/contacts/${id}`, { method: "DELETE" });
    loadContacts();
  };

  return (
    <div className="page">
      <h1>Emergency Contacts</h1>
      <p className="hint">
        The first contact here is shown on the phone's alerted screen when a fall is confirmed.
      </p>

      <form onSubmit={addContact} className="contact-form">
        <input
          type="text"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="text"
          placeholder="Relationship (optional)"
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        />
        <button className="btn btn-primary" type="submit">
          Add Contact
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {loading && <p>Loading...</p>}
      {!loading && contacts.length === 0 && <p>No contacts yet — add one above.</p>}
      {contacts.length > 0 && (
        <ul className="contact-list">
          {contacts.map((c) => (
            <li key={c.id}>
              <span>
                {c.name}
                {c.relationship ? ` (${c.relationship})` : ""}
              </span>
              <button className="btn btn-danger" onClick={() => removeContact(c.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
