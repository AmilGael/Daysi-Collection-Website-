import type { BusinessInfo } from "./types";

/**
 * ERD: BUSINESS_INFO. One record, read by the header, footer, contact page and
 * Google Business section.
 *
 * The address stays at neighbourhood level by choice: this is a private home
 * atelier, and the street is given to a client when her appointment is
 * confirmed, not to the internet. `googleProfileVerified` stays false until
 * her real listing is connected, and the UI says so rather than implying a
 * rating she has not earned yet.
 */
export const business: BusinessInfo = {
  legalName: "Daysi Collection Inc.",
  displayName: "Daysi Collection",
  tagline: {
    en: "Custom garments, alterations and heritage pieces, made in the Bronx since 2008.",
    es: "Prendas a medida, arreglos y piezas de herencia, hechas en el Bronx desde 2008.",
  },
  foundedYear: 2008,
  serviceArea: {
    en: "The Bronx and greater New York City",
    es: "El Bronx y el área de Nueva York",
  },
  neighborhood: "East 180th Street, Bronx, NY",
  addressNote: {
    en: "A private home atelier. The full address is shared when your appointment is confirmed.",
    es: "Un taller privado en casa. La dirección completa se comparte al confirmar su cita.",
  },
  hours: [
    { day: { en: "Monday", es: "Lunes" }, opens: "10:00", closes: "18:00" },
    { day: { en: "Tuesday", es: "Martes" }, opens: "10:00", closes: "18:00" },
    { day: { en: "Wednesday", es: "Miércoles" }, opens: "10:00", closes: "18:00" },
    { day: { en: "Thursday", es: "Jueves" }, opens: "10:00", closes: "18:00" },
    { day: { en: "Friday", es: "Viernes" }, opens: "10:00", closes: "16:00" },
    { day: { en: "Saturday", es: "Sábado" }, opens: "11:00", closes: "15:00" },
    { day: { en: "Sunday", es: "Domingo" }, opens: "", closes: null },
  ],
  // Her real number, and it is never printed. It is here so the WhatsApp
  // buttons have somewhere to point; every place that used to show it now
  // shows a label instead. There is no `phone` field on purpose — see the
  // note on BusinessInfo.
  whatsapp: "+19176887260",
  // A real, receiving address: Cloudflare Email Routing forwards it (and any
  // guessed address at the domain, via the catch-all) into Gmail.
  email: "hola@daysiscollectioninc.com",
  google: {
    profileUrl: "https://www.google.com/search?q=Daysi+Collection+Inc+Bronx",
    directionsUrl: "https://www.google.com/maps/dir/?api=1&destination=E+180th+St+Bronx+NY",
    reviewUrl: "https://www.google.com/search?q=Daysi+Collection+Inc+Bronx",
    mapEmbedUrl:
      "https://www.google.com/maps?q=East+180th+Street,+Bronx,+NY&output=embed",
    rating: 5,
    reviewCount: 0,
  },
  social: {
    instagram: "https://www.instagram.com/daysicollection",
    youtube: "https://www.youtube.com/@daysicollection",
    tiktok: null,
    facebook: null,
  },
};

/**
 * Flip to true once Daysi's Google Business Profile is connected and the rating
 * and review count above come from her real listing.
 */
export const googleProfileVerified = false;
