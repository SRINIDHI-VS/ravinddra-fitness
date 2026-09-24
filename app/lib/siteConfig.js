export const SITE_URL = "https://ravindrafitness.vercel.app";

export const CONTACT = {
  whatsappNumber: "919902269943",
  upiId: "9902269943@ybl",
  upiPayee: "Ravindra M B",
  instagramHandle: "@ravindramb",
  instagramUrl: "https://www.instagram.com/ravindramb/",
};

export function whatsappLink(message) {
  const base = `https://wa.me/${CONTACT.whatsappNumber}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function waLinkTo(phone, message) {
  const base = `https://wa.me/91${phone}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function upiDeepLink() {
  return `upi://pay?pa=${encodeURIComponent(CONTACT.upiId)}&pn=${encodeURIComponent(CONTACT.upiPayee)}&cu=INR`;
}
