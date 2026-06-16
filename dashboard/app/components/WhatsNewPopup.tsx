"use client";

import { useEffect, useState } from "react";

// Incremente a versão para reexibir o pop-up quando houver novidades.
const VERSION = "2026-06-16";
const STORAGE_KEY = "pulso_whatsnew_seen";

export default function WhatsNewPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== VERSION) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function close() {
    try {
      localStorage.setItem(STORAGE_KEY, VERSION);
    } catch {}
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />

      {/* Card */}
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto"
        style={{
          background: "var(--paper-white)",
          border: "1px solid var(--fio)",
          borderRadius: "4px",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Faixa superior editorial */}
        <div className="text-center pt-6 pb-4 px-6" style={{ borderBottom: "1px solid var(--fio)" }}>
          <p className="text-xs uppercase tracking-[0.3em]" style={{ color: "var(--editorial-red)" }}>
            Edição Atualizada
          </p>
          <h2 className="font-editorial text-2xl font-black mt-2" style={{ color: "var(--ink)" }}>
            O que há de novo
          </h2>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Mais notícias */}
          <div className="flex gap-3">
            <div
              className="shrink-0 w-9 h-9 flex items-center justify-center"
              style={{ background: "var(--paper-dark)", borderRadius: "4px", color: "var(--editorial-red)" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <div>
              <h3 className="font-editorial font-semibold text-base" style={{ color: "var(--ink)" }}>
                Muito mais notícias por dia
              </h3>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                Melhoramos a captura: agora lemos <strong>todas as páginas</strong> de cada portal (antes só a
                primeira, perdendo matérias das cidades grandes), recuperamos as publicações da{" "}
                <strong>véspera</strong> e reativamos <strong>dezenas de municípios</strong> que estavam mudos.
                O resultado é um volume diário bem maior — passamos a fechar acima de <strong>300 notícias/dia</strong>{" "}
                nos dias úteis.
              </p>
            </div>
          </div>

          {/* Marcar inválida */}
          <div className="flex gap-3">
            <div
              className="shrink-0 w-9 h-9 flex items-center justify-center"
              style={{ background: "var(--paper-dark)", borderRadius: "4px", color: "var(--editorial-red)" }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <h3 className="font-editorial font-semibold text-base" style={{ color: "var(--ink)" }}>
                Marque uma notícia como <em>inválida</em>
              </h3>
              <p className="text-sm mt-1 leading-relaxed" style={{ color: "var(--ink-secondary)" }}>
                Com mais volume, pode aparecer algo que não deveria. Agora você resolve em 1 clique: passe o
                mouse sobre qualquer notícia (ou abra o painel dela) e clique em{" "}
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 align-middle"
                  style={{ border: "1px solid var(--fio)", borderRadius: "2px", color: "var(--editorial-red)", fontSize: "11px" }}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Inválida
                </span>
                . Ela <strong>some do feed na hora</strong>. Não se preocupa: nada é apagado de verdade — se errar,
                aparece um botão <strong>Desfazer</strong> por alguns segundos.
              </p>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="px-6 pb-6 pt-1">
          <button
            onClick={close}
            className="w-full py-2.5 text-sm font-semibold uppercase tracking-wide transition-opacity hover:opacity-90"
            style={{ background: "var(--editorial-red)", color: "white", borderRadius: "3px", border: "none" }}
          >
            Entendi, vamos lá
          </button>
        </div>
      </div>
    </div>
  );
}
