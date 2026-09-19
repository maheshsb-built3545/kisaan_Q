import { useNavigate } from 'react-router-dom';

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <main className="flex flex-col min-h-screen bg-surface items-center justify-center px-4 font-jakarta text-center">
      <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl p-8 shadow-xl space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-error-container text-on-error-container mx-auto flex items-center justify-center shadow-inner">
          <span className="material-symbols-outlined text-4xl">travel_explore</span>
        </div>
        <div className="space-y-2">
          <span className="text-xs font-extrabold text-error uppercase tracking-widest block">ERROR 404 • PAGE NOT FOUND</span>
          <h1 className="text-2xl font-black text-on-surface">पृष्ठ नहीं मिला / Page Not Found</h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            आप जिस पृष्ठ की तलाश कर रहे हैं वह मौजूद नहीं है या स्थानांतरित कर दिया गया है।
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <button
            id="not-found-home-btn"
            onClick={() => navigate('/')}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-xl">home</span>
            मुख्य द्वार पर जाएं / Go to Main Gateway
          </button>
          <button
            id="not-found-back-btn"
            onClick={() => navigate(-1)}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-xl">arrow_back</span>
            पीछे जाएं / Go Back
          </button>
        </div>
      </div>
    </main>
  );
}
