const TelegramBot = require('node-telegram-bot-api');

// Replace with your actual BotFather token
const token = '7592030665:AAGBTJXfcG-EQQq_ShX_SmJDXJroYkiWG20';

// ✅ Your supergroup ID
const groupChatId = -1002288565293;

// ✅ Topic IDs
const apkTopic1 = 2547;
const apkTopic2 = 1427;
const apkTopic3 = 56; // Topic 3 is default for /sendmedia

// ✅ Welcome topic ID
const welcomeTopicId = 2754;

// ✅ JSON file topic ID
const jsonTopicId = 1605;

// ✅ Your personal Telegram user ID
const adminId = 5320958997;

const bot = new TelegramBot(token, { polling: true });

console.log('🤖 Bot is running...');

// ✅ Track welcomed users
const welcomedUsers = new Set();

// ✅ Welcome handler
bot.on('chat_member', async (msg) => {
    const chatId = msg.chat.id;
    const user = msg.new_chat_member.user;
    const newStatus = msg.new_chat_member.status;

    if (chatId === groupChatId) {
        if (newStatus === 'member' || newStatus === 'administrator') {
            if (welcomedUsers.has(user.id)) return;
            welcomedUsers.add(user.id);

            const name = user.first_name || user.username || "friend";
            const mention = `[${name}](tg://user?id=${user.id})`;

            const welcomeText = `Hey ${mention} 👋\nWelcome aboard! You’re now part of *Instawiz Community* 🌟`;

            try {
                await bot.sendMessage(groupChatId, welcomeText, {
                    message_thread_id: welcomeTopicId,
                    parse_mode: "Markdown"
                });
                console.log(`✅ Sent welcome message to ${user.id}`);
            } catch (err) {
                console.error("❌ Error sending welcome message:", err.message);
            }
        }
    }
});

bot.onText(/\/sendmedia/, async (msg) => {
    const chatId = msg.chat.id;

    if (chatId !== adminId) {
        return bot.sendMessage(chatId, "❌ You're not authorized to use this command.");
    }

    let mediaItems = [];

    bot.sendMessage(chatId, "📸 Send up to 10 *photos or videos*, one by one.\nType `/done` when finished.", {
        parse_mode: 'Markdown',
    });

    const mediaCollector = async (mediaMsg) => {
        if (mediaMsg.chat.id !== chatId) return;

        // Finish input
        if (mediaMsg.text === '/done') {
            bot.removeListener('message', mediaCollector);

            if (mediaItems.length === 0) {
                return bot.sendMessage(chatId, "⚠️ No media was collected.");
            }

            bot.sendMessage(chatId, "📝 Now send a description (caption) for the post:");

            bot.once('message', async (captionMsg) => {
                const caption = captionMsg.text?.trim();

                if (caption) {
                    mediaItems[0].caption = caption;
                    mediaItems[0].parse_mode = 'Markdown'; // Optional: change to 'HTML' for easier formatting
                }

                try {
                    await bot.sendMediaGroup(groupChatId, mediaItems, {
                        message_thread_id: apkTopic3, // Topic 3 (ID: 56)
                    });

                    bot.sendMessage(chatId, `✅ Media successfully sent to Topic 3.`);
                } catch (err) {
                    console.error("❌ Error sending media group:", err.message);
                    bot.sendMessage(chatId, "❌ Failed to send media. Make sure the bot can post in Topic 3.");
                }
            });

            return;
        }

        try {
            if (mediaItems.length >= 10) {
                return bot.sendMessage(chatId, "⚠️ You've reached the limit of 10 media items. Type `/done` to continue.");
            }

            if (mediaMsg.photo) {
                const fileId = mediaMsg.photo[mediaMsg.photo.length - 1].file_id;
                mediaItems.push({ type: 'photo', media: fileId });
            } else if (mediaMsg.video) {
                const fileId = mediaMsg.video.file_id;
                mediaItems.push({ type: 'video', media: fileId });
            } else {
                bot.sendMessage(chatId, "⚠️ Only photos or videos are supported. Send `/done` to finish.");
            }
        } catch (err) {
            console.error("❌ Media parsing error:", err.message);
            bot.sendMessage(chatId, "⚠️ Failed to process the media file.");
        }
    };

    bot.on('message', mediaCollector);
});


// ✅ Handle APK and JSON uploads
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type !== 'private') return;
    if (chatId !== adminId) return bot.sendMessage(chatId, "❌ You're not authorized to use this bot.");

    const document = msg.document;

    if (document && document.file_name.endsWith('.apk')) {
        const fileId = document.file_id;
        const fileName = document.file_name;

        bot.sendMessage(chatId, "📝 Please send a description for this APK:");
        bot.once('message', async (descMsg) => {
            const description = descMsg.text;

            bot.sendMessage(chatId, "📌 Which topic do you want to send it to?\nReply with:\n1️⃣ for Topic 1\n2️⃣ for Topic 2\n3️⃣ for Topic 3");

            bot.once('message', async (topicChoiceMsg) => {
                const choice = topicChoiceMsg.text.trim();
                let selectedTopic = apkTopic1;
                if (choice === '2') selectedTopic = apkTopic2;
                else if (choice === '3') selectedTopic = apkTopic3;

                try {
                    await bot.sendDocument(groupChatId, fileId, {
                        caption: description,
                        message_thread_id: selectedTopic
                    });
                    bot.sendMessage(chatId, `✅ APK "${fileName}" sent to Topic ${choice}.`);
                } catch (err) {
                    console.error("❌ Error sending APK:", err.message);
                    bot.sendMessage(chatId, "❌ Failed to send APK. Check bot permissions.");
                }
            });
        });

    } else if (msg.text === '/sendjson') {
        bot.sendMessage(chatId, "📂 Please send the `.json` file to send to the group:");

        bot.once('document', async (jsonMsg) => {
            const jsonFile = jsonMsg.document;

            if (!jsonFile.file_name.endsWith('.json')) {
                return bot.sendMessage(chatId, "❌ That doesn't look like a `.json` file.");
            }

            bot.sendMessage(chatId, "📝 Now send an optional description (or type /skip to send without caption):");

            bot.once('message', async (captionMsg) => {
                const description = captionMsg.text === '/skip' ? undefined : captionMsg.text;

                try {
                    await bot.sendDocument(groupChatId, jsonFile.file_id, {
                        caption: description,
                        message_thread_id: jsonTopicId
                    });
                    bot.sendMessage(chatId, `✅ JSON file "${jsonFile.file_name}" sent to group.`);
                } catch (err) {
                    console.error("❌ Error sending JSON:", err.message);
                    bot.sendMessage(chatId, "❌ Failed to send JSON. Check bot permissions.");
                }
            });
        });

    } else if (msg.text !== '/sendmedia') {
        bot.sendMessage(chatId, "📦 Please send a valid `.apk` file or use /sendjson to upload a JSON.");
    }
});
