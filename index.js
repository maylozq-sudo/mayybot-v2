const { Client, GatewayIntentBits, PermissionFlagsBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
});

const userMessageMap = new Map();
const warningsMap = new Map();

const LIMIT_MESSAGES = 3; 
const TIME_WINDOW = 5000;  

// ID de tes rôles de warn configurés
const ROLE_WARN_1_ID = '1550754107978022912'; 
const ROLE_WARN_2_ID = '1550754764025765890'; 

const commands = [
  new SlashCommandBuilder()
    .setName('clear')
    .setDescription('Supprime un nombre précis de messages')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de messages à supprimer (1-99)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(99)
    ),
  new SlashCommandBuilder()
    .setName('spam')
    .setDescription('Fait répéter un texte au bot (Modérateur)')
    .addIntegerOption(option =>
      option.setName('nombre')
        .setDescription('Nombre de répétitions (1-20)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(20)
    )
    .addStringOption(option =>
      option.setName('texte')
        .setDescription('Le texte à répéter')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('warn')
    .setDescription('Donne un avertissement à un membre (Modérateur)')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à avertir')
        .setRequired(true)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('La raison de l avertissement')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('warnings')
    .setDescription('Affiche les avertissements d un membre')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre dont tu veux voir les warns')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('pardon')
    .setDescription('Efface tous les warns et retire les rôles de sanction (Modérateur)')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à pardonner')
        .setRequired(true)
    ),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Rend muet temporairement un membre (Modérateur)')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à rendre muet')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option.setName('minutes')
        .setDescription('Durée en minutes (1 à 1440)')
        .setRequired(true)
        .setMinValue(1)
        .setMaxValue(1440)
    )
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('La raison du mute')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('lock')
    .setDescription('Verrouille le salon actuel (Interdit d écrire pour les membres) (Modérateur)')
    .addStringOption(option =>
      option.setName('raison')
        .setDescription('La raison du verrouillage')
        .setRequired(false)
    ),
  new SlashCommandBuilder()
    .setName('unlock')
    .setDescription('Déverrouille le salon actuel (Modérateur)'),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Affiche les informations d un utilisateur')
    .addUserOption(option =>
      option.setName('membre')
        .setDescription('Le membre à analyser')
        .setRequired(false)
    )
];

client.once('ready', async () => {
  console.log(`Bot prêt ! Connecté en tant que ${client.user.tag}`);

  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    const guilds = await client.guilds.fetch();
    for (const [guildId] of guilds) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guildId),
        { body: commands.map(cmd => cmd.toJSON()) },
      );
    }
    console.log('Commandes enregistrées avec succès sur le serveur !');
  } catch (error) {
    console.error(error);
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const inviteRegex = /(https?:\/\/)?(www\.)?(discord\.(gg|io|me|li|club)|discordapp\.com\/invite|discord\.com\/invite)\/[a-zA-Z0-9]+/i;
  if (inviteRegex.test(message.content)) {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.delete().catch(() => {});
      const warningMsg = await message.channel.send(`⚠️ ${message.author}, les liens d'invitation vers d'autres serveurs sont interdits ici !`);
      setTimeout(() => warningMsg.delete().catch(() => {}), 4000);
      return;
    }
  }

  const userId = message.author.id;
  const now = Date.now();

  if (!userMessageMap.has(userId)) {
    userMessageMap.set(userId, []);
  }

  const userHistory = userMessageMap.get(userId);
  userHistory.push({ time: now, msg: message });

  const recentHistory = userHistory.filter(entry => now - entry.time < TIME_WINDOW);
  userMessageMap.set(userId, recentHistory);

  if (recentHistory.length > LIMIT_MESSAGES) {
    if (message.channel.permissionsFor(message.guild.members.me).has(PermissionFlagsBits.ManageMessages)) {
      const messagesToDelete = recentHistory.map(entry => entry.msg);
      
      try {
        await message.channel.bulkDelete(messagesToDelete, true);
      } catch (err) {
        for (const entry of recentHistory) {
          await entry.msg.delete().catch(() => {});
        }
      }

      userMessageMap.set(userId, []);

      const warning = await message.channel.send(`⚠️ ${message.author}, le spam est limité à 3 messages d'affilée ! Tout a été supprimé.`);
      setTimeout(() => warning.delete().catch(() => {}), 4000);
      return;
    }
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const { commandName } = interaction;

  if (commandName === 'clear') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "Tu n'as pas la permission de gérer les messages !", ephemeral: true });
    }

    const amount = interaction.options.getInteger('nombre');
    await interaction.deferReply({ ephemeral: true });

    try {
      const deleted = await interaction.channel.bulkDelete(amount, true);
      await interaction.editReply(`🧹 **${deleted.size}** message(s) supprimé(s) avec succès !`);
    } catch (error) {
      console.error(error);
      await interaction.editReply("Erreur lors de la suppression.");
    }
  }

  if (commandName === 'spam') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "Seuls les modérateurs peuvent utiliser cette commande !", ephemeral: true });
    }

    const count = interaction.options.getInteger('nombre');
    const text = interaction.options.getString('texte');

    await interaction.reply({ content: "Envoi du spam en cours...", ephemeral: true });

    for (let i = 0; i < count; i++) {
      await interaction.channel.send(text);
    }
  }

  if (commandName === 'warn') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "Tu n'as pas la permission d'avertir des membres !", ephemeral: true });
    }

    const targetUser = interaction.options.getUser('membre');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
    const reason = interaction.options.getString('raison');

    if (!warningsMap.has(targetUser.id)) {
      warningsMap.set(targetUser.id, []);
    }

    const userWarns = warningsMap.get(targetUser.id);
    userWarns.push({
      reason: reason,
      moderator: interaction.user.tag,
      date: new Date().toLocaleDateString()
    });

    let sanctionMessage = `⚠️ **${targetUser.tag}** a reçu son **${userWarns.length}e avertissement**.\n**Raison :** ${reason}`;

    if (targetMember) {
      try {
        if (userWarns.length === 1) {
          await targetMember.roles.add(ROLE_WARN_1_ID);
          sanctionMessage += `\n*(Rôle "Warn 1" attribué automatiquement)*`;
        } 
        else if (userWarns.length >= 2) {
          await targetMember.timeout(10 * 60 * 1000, `Sanction automatique : 2ème avertissement.`);
          sanctionMessage += `\n🚨 **Sanction automatique (2ème avertissement) :** Timeout de 10 minutes appliqué !`;

          // Retire le premier rôle et ajoute le second pour une progression propre
          await targetMember.roles.remove(ROLE_WARN_1_ID).catch(() => {});
          await targetMember.roles.add(ROLE_WARN_2_ID);
          sanctionMessage += ` + Rôle "Warn 2" attribué.`;
        }
      } catch (err) {
        console.error("Erreur attribution rôle/timeout :", err);
        sanctionMessage += `\n*(Erreur : vérifie que le rôle du bot est bien au-dessus des rôles de warn)*`;
      }
    }

    await interaction.reply({ content: sanctionMessage, ephemeral: false });
  }

  if (commandName === 'warnings') {
    const target = interaction.options.getUser('membre');
    const userWarns = warningsMap.get(target.id) || [];

    if (userWarns.length === 0) {
      return interaction.reply({ content: `✅ **${target.tag}** n'a aucun avertissement à son actif.`, ephemeral: true });
    }

    let description = userWarns.map((w, index) => `**${index + 1}.** ${w.reason} *(Modérateur : ${w.moderator} - ${w.date})*`).join('\n');

    const embed = new EmbedBuilder()
      .setTitle(`Avertissements de ${target.tag}`)
      .setDescription(description)
      .setColor('#ffcc00');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (commandName === 'pardon') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: "Tu n'as pas la permission de pardonner des membres !", ephemeral: true });
    }

    const targetUser = interaction.options.getUser('membre');
    const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

    if (warningsMap.has(targetUser.id)) {
      warningsMap.delete(targetUser.id);
    }

    if (targetMember) {
      try {
        await targetMember.roles.remove(ROLE_WARN_1_ID).catch(() => {});
        await targetMember.roles.remove(ROLE_WARN_2_ID).catch(() => {});
      } catch (err) {
        console.error("Erreur lors du retrait des rôles :", err);
      }
    }

    await interaction.reply({ content: `✅ Le casier de **${targetUser.tag}** a été remis à zéro (warns effacés et rôles retirés).`, ephemeral: false });
  }

  if (commandName === 'timeout') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return interaction.reply({ content: "Tu n'as pas la permission de rendre des membres muets !", ephemeral: true });
    }

    const member = interaction.options.getMember('membre');
    const minutes = interaction.options.getInteger('minutes');
    const reason = interaction.options.getString('raison') || "Aucune raison spécifiée";

    try {
      const durationMs = minutes * 60 * 1000;
      await member.timeout(durationMs, reason);
      await interaction.reply({ content: `🔇 **${member.user.tag}** a été mis en sourdine pendant **${minutes} minute(s)**.\n**Raison :** ${reason}`, ephemeral: false });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: "Impossible de rendre ce membre muet.", ephemeral: true });
    }
  }

  if (commandName === 'lock') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: "Tu n'as pas la permission de verrouiller des salons !", ephemeral: true });
    }

    const reason = interaction.options.getString('raison') || "Aucune raison spécifiée";

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: false
      });

      const embed = new EmbedBuilder()
        .setTitle('🔒 Salon Verrouillé')
        .setDescription(`Ce salon a été verrouillé par un modérateur.\n**Raison :** ${reason}`)
        .setColor('#ff0000');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: "Impossible de verrouiller ce salon.", ephemeral: true });
    }
  }

  if (commandName === 'unlock') {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
      return interaction.reply({ content: "Tu n'as pas la permission de déverrouiller des salons !", ephemeral: true });
    }

    try {
      await interaction.channel.permissionOverwrites.edit(interaction.guild.roles.everyone, {
        SendMessages: null
      });

      const embed = new EmbedBuilder()
        .setTitle('🔓 Salon Déverrouillé')
        .setDescription('Ce salon a été déverrouillé. Vous pouvez de nouveau écrire.')
        .setColor('#00ff00');

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error(error);
      await interaction.reply({ content: "Impossible de déverrouiller ce salon.", ephemeral: true });
    }
  }

  if (commandName === 'userinfo') {
    const member = interaction.options.getMember('membre') || interaction.member;
    const user = member.user;

    const embed = new EmbedBuilder()
      .setTitle(`Informations sur ${user.tag}`)
      .setThumbnail(user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: 'Nom d utilisateur', value: user.tag, inline: true },
        { name: 'ID', value: user.id, inline: true },
        { name: 'Création du compte', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'Arrivée sur le serveur', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true }
      )
      .setColor('#0099ff');

    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
});

client.login(process.env.DISCORD_TOKEN);
