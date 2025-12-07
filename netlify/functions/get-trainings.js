exports.handler = async function(event, context) {
  const trainingen = [
    {
      id: 1,
      datum: "15/12/2025",
      tijd: "20:00",
      trainer: "John_Doe",
      onderwerp: "Politie Basis Training"
    },
    {
      id: 2,
      datum: "17/12/2025", 
      tijd: "19:30",
      trainer: "Medic_Sarah",
      onderwerp: "EHBO Gevorderd"
    }
  ];
  
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(trainingen)
  };
};