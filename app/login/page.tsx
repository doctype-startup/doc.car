import LoginSignupForm from "./login-form";

export default function LoginPage() {
  return (
    <div className="login-page">
      <div className="login-brand">
        <div className="brand">
          DOC<span>.CAR</span>
        </div>
        <p>
          Consulta veicular completa para despachantes — placa, ficha
          técnica, FIPE, débitos e restrições em um só lugar. Um produto{" "}
          <strong>DOCTYPE</strong>.
        </p>
      </div>
      <div className="login-panel">
        <div className="login-card">
          <div className="orange-line" />
          <LoginSignupForm />
        </div>
      </div>
    </div>
  );
}
