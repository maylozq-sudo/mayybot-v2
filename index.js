const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Map pour suivre la fréquence et stocker les messages des utilisateurs
const userMessageMap = new Map();

// Configuration Anti-Spam
const LIMIT_MESSAGES = 5; // Nombre max de messages tolérés
const TIME_WINDOW = 5000;  // Fenêtre de 5 secondes (5000 ms)

client.once('ready', () => {
  console.log(`Bot prêt ! Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // --- SYSTÈME ANTI-SPAM (SUPPRESSION DE TOUT L'HISTORIQUE RÉCENT) ---
  const userId = message.author.id;
  const now = Date.now();

  if (!userMessageMap.has(userId)) {
    userMessageMap.set(userId, []);
  }

  const userHistory = userMessageMap.get(userId);
  // On ajoute le message actuel à l'historique
  userHistory.push({ time: now, msg: message });

  // Conserver uniquement les messages envoyés dans les 5 dernières secondes
  const recentHistory = userHistory.filter(entry => now - entry.time < TIME_WINDOW);
  userMessageMap.set(userId, recentHistory);

  // Détection du dépassement de limite
  if (recentHistory.length > LIMIT_MESSAGES) {
    if (message.channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      
      // Récupérer et supprimer tous les messages récents envoyés par cet utilisateur
      const messagesToDelete = recentHistory.map(entry => entry.msg);
      
      try {
        await message.channel.bulkDelete(messagesToDelete, true);
      } catch (err) {
        // En cas d'échec de suppression en masse, suppression un par un
        for (const entry of recentHistory) {
          await entry.msg.delete().catch(() => {});
        }
      }

      // Vider l'historique pour cet utilisateur après suppression
      userMessageMap.set(userId, []);

      // Avertissement dans le salon
      const warning = await message.channel.send(`⚠️ ${message.author}, le spam est interdit ! Tous tes récents messages ont été supprimés.`);
      setTimeout(() => warning.delete().catch(() => {}), 4000);
      return;
    }
  }

  // --- COMMANDES BOT ---
  const args = message.content.trim().split(/ +/);
  const command = args.shift().toLowerCase();

  // Commande de suppression (!clear <nombre>)
  if (command === '!clear' || command === '!clean') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("Tu n'as pas la permission de gérer les messages !");
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 99) {
      return message.reply("Indique un nombre entre 1 et 99. Exemple : `!clear 10`");
    }

    try {
      await message.channel.bulkDelete(amount + 1, true);
      const msg = await message.channel.send(`🧹 **${amount}** message(s) supprimé(s) !`);
      setTimeout(() => msg.delete().catch(() => {}), 3000);
    } catch (error) {
      console.error(error);
      message.reply("Erreur lors de la suppression (messages trop anciens ?).");
    }
  }

  // Commande de spam manuel (!spam <nombre> <texte>)
  if (command === '!spam') {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply("Seuls les modérateurs peuvent utiliser la commande spam !");
    }

    const count = parseInt(args[0]);
    const text = args.slice(1).join(' ');

    if (isNaN(count) || count < 1 || count > 20) {
      return message.reply("Indique un nombre entre 1 et 20. Exemple : `!spam 5 Coucou`");
    }

    if (!text) {
      return message.reply("Tu dois écrire le texte à répéter. Exemple : `!spam 5 Salut`");
    }

    await message.delete().catch(() => {});

    for (let i = 0; i < count; i++) {
      await message.channel.send(text);
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
