import { createContext, useCallback, useContext, useState } from "react";
import type { Locale } from "./types";

type Messages = Record<string, string>;

const translations: Record<Locale, Messages> = {
  en: {
    "nav.home": "Home",
    "nav.proposals": "Proposals",
    "nav.governance": "Governance",
    "nav.forum": "Forum",
    "nav.api": "API",
    "nav.docs": "Docs",
    "auth.connect": "Connect",
    "auth.disconnect": "Disconnect",
    "auth.connecting": "Connecting...",
    "balance.icfc": "ICFC",
    "balance.vp": "Voting Power",
    "proposal.submit": "Submit Proposal",
    "proposal.vote": "Vote",
    "proposal.execute": "Execute",
    "proposal.simulate": "Simulate",
    "proposal.dispute": "Dispute",
    "vote.for": "Vote For",
    "vote.against": "Vote Against",
    "forum.newThread": "New Thread",
    "forum.reply": "Reply",
    "governance.settings": "Governance Settings",
    "api.registerKey": "Get API Access",
    "api.deposit": "Deposit Balance",
    "common.loading": "Loading...",
    "common.empty": "No data yet",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.close": "Close",
    "profile.setup": "Set Up Profile",
    "profile.displayName": "Display Name",
    "profile.bio": "Bio",
    "profile.language": "Preferred Language",
    "profile.accessLevel": "Access Level",
    "profile.holder": "ICFC Holder",
    "profile.readonly": "Read-Only",
  },
  es: {
    "nav.home": "Inicio",
    "nav.proposals": "Propuestas",
    "nav.governance": "Gobernanza",
    "nav.forum": "Foro",
    "nav.api": "API",
    "nav.docs": "Docs",
    "auth.connect": "Conectar",
    "auth.disconnect": "Desconectar",
    "auth.connecting": "Conectando...",
    "balance.icfc": "ICFC",
    "balance.vp": "Poder de Voto",
    "proposal.submit": "Enviar Propuesta",
    "proposal.vote": "Votar",
    "proposal.execute": "Ejecutar",
    "proposal.simulate": "Simular",
    "proposal.dispute": "Disputar",
    "vote.for": "Votar A Favor",
    "vote.against": "Votar En Contra",
    "forum.newThread": "Nuevo Hilo",
    "forum.reply": "Responder",
    "governance.settings": "Configuración de Gobernanza",
    "api.registerKey": "Obtener Acceso API",
    "api.deposit": "Depositar Saldo",
    "common.loading": "Cargando...",
    "common.empty": "Sin datos aún",
    "common.save": "Guardar",
    "common.cancel": "Cancelar",
    "common.close": "Cerrar",
    "profile.setup": "Configurar Perfil",
    "profile.displayName": "Nombre Visible",
    "profile.bio": "Biografía",
    "profile.language": "Idioma Preferido",
    "profile.accessLevel": "Nivel de Acceso",
    "profile.holder": "Titular de ICFC",
    "profile.readonly": "Solo Lectura",
  },
  vi: {
    "nav.home": "Trang chủ",
    "nav.proposals": "Đề xuất",
    "nav.governance": "Quản trị",
    "nav.forum": "Diễn đàn",
    "nav.api": "API",
    "nav.docs": "Tài liệu",
    "auth.connect": "Kết nối",
    "auth.disconnect": "Ngắt kết nối",
    "auth.connecting": "Đang kết nối...",
    "balance.icfc": "ICFC",
    "balance.vp": "Quyền bầu chọn",
    "proposal.submit": "Nộp đề xuất",
    "proposal.vote": "Bỏ phiếu",
    "proposal.execute": "Thực thi",
    "proposal.simulate": "Mô phỏng",
    "proposal.dispute": "Phản đối",
    "vote.for": "Bỏ phiếu ủng hộ",
    "vote.against": "Bỏ phiếu phản đối",
    "forum.newThread": "Chủ đề mới",
    "forum.reply": "Trả lời",
    "governance.settings": "Cài đặt quản trị",
    "api.registerKey": "Lấy Quyền Truy Cập API",
    "api.deposit": "Nạp số dư",
    "common.loading": "Đang tải...",
    "common.empty": "Chưa có dữ liệu",
    "common.save": "Lưu",
    "common.cancel": "Hủy",
    "common.close": "Đóng",
    "profile.setup": "Thiết lập hồ sơ",
    "profile.displayName": "Tên hiển thị",
    "profile.bio": "Tiểu sử",
    "profile.language": "Ngôn ngữ ưa thích",
    "profile.accessLevel": "Cấp độ truy cập",
    "profile.holder": "Người nắm giữ ICFC",
    "profile.readonly": "Chỉ đọc",
  },
};

interface I18nContextValue {
  t: (key: string) => string;
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const I18nContext = createContext<I18nContextValue>({
  t: (key) => key,
  locale: "en",
  setLocale: () => undefined,
});

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}

export function useI18nState() {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const stored = localStorage.getItem("footballheir_locale");
    return (stored as Locale) || "en";
  });

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    localStorage.setItem("footballheir_locale", next);
  }, []);

  const t = useCallback(
    (key: string): string => {
      return translations[locale][key] ?? translations.en[key] ?? key;
    },
    [locale],
  );

  return { t, locale, setLocale };
}
