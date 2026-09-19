const { Client, GatewayIntentBits, PermissionFlagsBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

// Map pour suivre la fréquence d'envoi de messages des utilisateurs
const userMessageMap = new Map();

// Configuration Anti-Spam
const LIMIT_MESSAGES = 5; // Nombre de messages max
const TIME_WINDOW = 5000;  // Dans un délai de 5 secondes (5000 ms)

client.once('ready', () => {
  console.log(`Bot prêt ! Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // --- SYSTÈME ANTI-SPAM ---
  const userId = message.author.id;
  const now = Date.now();

  if (!userMessageMap.has(userId)) {
    userMessageMap.set(userId, []);
  }

  const userTimestamps = userMessageMap.get(userId);
  userTimestamps.push(now);

  // Conserver uniquement les timestamps dans la fenêtre de temps (5 sec)
  const recentMessages = userTimestamps.filter(timestamp => now - timestamp < TIME_WINDOW);
  userMessageMap.set(userId, recentMessages);

  // Si l'utilisateur dépasse la limite
  if (recentMessages.length > LIMIT_MESSAGES) {
    if (message.channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      await message.delete().catch(() => {});
      
      if (recentMessages.length === LIMIT_MESSAGES + 1) {
        const warning = await message.channel.send(`⚠️ ${message.author}, mollo sur le spam ! Tes messages trop rapides sont supprimés.`);
        setTimeout(() => warning.delete().catch(() => {}), 4000);
      }
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
