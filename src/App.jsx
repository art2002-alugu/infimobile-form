import React, { useState } from "react";

const GOOGLE_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbzDtLzCZmS-ORtG9Ge1DmjdaSozdAoOr-fLc2PVKDTPnO8V_2ojvHMjlzgcujllKXWl/exec";

export default function App() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  });

  const [status, setStatus] = useState("");

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("Submitting...");

    try {
      const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        body: new FormData(e.target),
      });

      if (response.ok) {
        setStatus("✅ Submitted successfully!");
        setFormData({ name: "", email: "", phone: "", message: "" });
      } else {
        setStatus("❌ Submission failed. Please try again.");
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus("⚠️ Network error. Check your script URL.");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(to bottom right, #667eea, #764ba2)",
        padding: "20px",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "white",
          borderRadius: "16px",
          padding: "30px 40px",
          width: "100%",
          maxWidth: "420px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
        }}
      >
        <h2 style={{ textAlign: "center", marginBottom: "20px" }}>
          Infimobile Contact Form
        </h2>

        <input
          type="text"
          name="name"
          placeholder="Full Name"
          value={formData.name}
          onChange={handleChange}
          required
          style={inputStyle}
        />
        <input
          type="email"
          name="email"
          placeholder="Email Address"
          value={formData.email}
          onChange={handleChange}
          required
          style={inputStyle}
        />
        <input
          type="tel"
          name="phone"
          placeholder="Phone Number"
          value={formData.phone}
          onChange={handleChange}
          required
          style={inputStyle}
        />
        <textarea
          name="message"
          placeholder="Your Message"
          value={formData.message}
          onChange={handleChange}
          rows="4"
          style={inputStyle}
        />

        <button
          type="submit"
          style={{
            background: "#667eea",
            color: "white",
            padding: "12px",
            border: "none",
            borderRadius: "8px",
            width: "100%",
            cursor: "pointer",
            fontWeight: "bold",
            transition: "background 0.3s",
          }}
        >
          Submit
        </button>

        <p
          style={{
            textAlign: "center",
            marginTop: "15px",
            color: "#333",
            fontSize: "0.9em",
          }}
        >
          {status}
        </p>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "12px",
  marginBottom: "15px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  fontSize: "1em",
};
