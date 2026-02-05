// app/config.js
// Config "editable" central y constantes

// ⚠️ En GitHub Pages esto NO es seguridad real (solo UI)
window.ADMIN_KEY = "CAMBIA-ESTO-1234";

window.APP_DEFAULTS = {
    seasonLabel: "2026",
    points: {
        bible: 1,
        scarf: 1,
        punctual: 2,
        notebook: 1,
        investedFriend: 20,
        eventParticipation: 10
    },
    blockRedeemIfInsufficient: true,

    home: {
        earnRules: [
            { label: "Biblia", points: 1 },
            { label: "Pañoleta", points: 1 },
            { label: "Puntualidad", points: 2 },
            { label: "Cuadernillo", points: 1 },
            { label: "Participación en evento", points: 10 },
            { label: "Amigo investido", points: 20 },
        ],
        loseRules: [
            { label: "Llegar tarde reiteradamente", points: -2 },
            { label: "Olvidar uniforme reiteradamente", points: -2 },
            { label: "No respetar indicaciones", points: -3 },
            { label: "Interrumpir actividades", points: -5 },
            { label: "Falta de respeto", points: -5 },
            { label: "Peleas", points: -10 },
        ]
    },

    upcomingEvents: [
        { date: "2026-03-14", name: "Servicio comunitario", place: "Parque", points: 10 },
        { date: "2026-04-11", name: "Caminata / Marcha", place: "Iglesia", points: 10 }
    ],

    demoMembers: [
        { name: "Bruno Paz (demo)", unit: "Halcones", active: true }
    ],

    demoPrizes: [
        { name: "Pulsera paracord con silbato y brújula", season: "sep", cost: 180, stock: 3, desc: "Útil para campamentos" },
        { name: "Gift card Temu", season: "dec", cost: 380, stock: 2, desc: "Premio grande" },
        { name: "Linterna profesional", season: "dec", cost: 280, stock: 2, desc: "" }
    ]
};