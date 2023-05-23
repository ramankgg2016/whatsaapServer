import WhatsappClient from "whatsapp-web.js";
import { isImageValid, getClientInstance } from "../utils/helpers.js";
import { BULK_MESSAGE_LIMIT } from "../utils/constants.js";
import axios from 'axios'
import WwebjsSender  from'@deathabyss/wwebjs-sender'; 
import { sessionManager } from "../sessionManager.js";
import request from 'request';
import { Buffer } from 'buffer';
import imageToBase64 from 'image-to-base64'
import mongoose from 'mongoose'
const ChatSchema = new mongoose.Schema({
    senderName: {
      type: String,
       default :''
    },MessageTo: {
      type: String,
      default:''
    },messageFrom: {
        type: String,
        default:''
      },messageID: {
        type: String,
        default:''
      },
      message: {
        type: String,
        default:''
      },
    messageTime: {
      type: Number,
      default: Date.now(),
    },
    createdAt: {
      type: Number,
      default: function() {
        return Date.now();
      }
    },media :{
      type:String,
      default:" "
    },
    type :{
      type:String,
      default:""
    },
  });
  
 export const ChatModel = mongoose.model('client-message', ChatSchema);

 const sectionSchema = new mongoose.Schema({
   sessionId: {
     type: String,
     default: 0,
   },
   sectionTitle: {
     type: String,
     default: "",
   },
   button: {
     type: Object,
     default: {},
   },
   createdAt: {
    type: Number,
    default: function() {
      return Date.now();
    }
  }
 });

export const sectionModel = mongoose.model('section-data', sectionSchema);

const menuSchema = new mongoose.Schema({
  sessionId: { type: String },
  body: { type: String },
  title: { type: String },
  footer: { type: String },
  menuName: { type: String },
  section: [{
    title: { type: String },
    rows: []
  }]
});

// Define the model for the data
export const MenuModel = mongoose.model('Menu', menuSchema);

//mongoose connection 
mongoose.connect('mongodb+srv://admin:admin@cluster0.kecoayn.mongodb.net/whatsapp', {
  useNewUrlParser: true,
}).then(() => console.log('MongoDB Connected'))
  .catch((err) => console.log(err));

  export const addMenu =async (req, res) => {
    try {
         req.body.sessionId=`${req.body.countryCode}${req.body.phoneNumber}@c.us`
         const filter = { sessionId: req.body.sessionId };
         const update = {
           sessionId: req.body.sessionId,
           body: req.body.body,
           title: req.body.title,
           footer: req.body.footer,
           menuName: req.body.menuName,
           section: req.body.section
         };
         
         const options = { upsert: true, new: true };
         
         const result = await MenuModel.findOneAndUpdate(filter, update, options);
         res.send(result);
    } catch (err) {
      console.log(err);
      res.status(500).send(err);
    }
  }
export const addSectionButton = async (req, res) => {
  console.log("calling addSection");
  let data = await sectionModel(req.body).save();
  res.send(data);
};

export const sendMessage = async (req, res) => {
  console.log("hello sendMessage");
  try {
      const client =  getClientInstance(req.params.clientSessionId);
      const { phoneNumber, countryCode, message } = req.body;
     // const formattedMessage = message.replace(/#/g, '\u0023').replace(/no/g, '\u200Eno\u200E');
    // console.log({ reqBody: req.body });

    if (!phoneNumber || !countryCode || !message) {
      return res.send({
        status: "error",
        message: `Invalid input to sendMessage, INPUT: ${req.body}`,
      });
    }
    const {
      id: { fromMe },
    } = await client.sendMessage(`${countryCode}${phoneNumber}@c.us`, message.toString());
    if (fromMe) {
      return res.send({
        status: "success",
        message: `Message successfully sent to ${phoneNumber}`,
      });
    }
  } catch (error) {
    console.log(`Error: sendMessag, ${error}`);
    return res.send({ status: "error", message: `Error` });
  }
};

export const sendImage = async (req, res) => {
  try {
    const client = getClientInstance(req.params.clientSessionId);
    const { phoneNumber, image, caption, countryCode } = req.body;
    if (!phoneNumber || !countryCode || !image ) {
      return res.send({
        status: "error",
        message: "please enter valid phone and base64/url of image",
      });
    }
    let base64 =await imageToBase64(image)
    let databash=`data:image/png;base64,${base64}`

    const media = new WhatsappClient.MessageMedia("image/png", base64);
    const {
      id: { fromMe },
    } = await client.sendMessage(`${countryCode}${phoneNumber}@c.us`, media, {
      caption: caption || "",
    });
    if (fromMe) {
      return res.send({
        status: "Success",
        message: `Image has been successfully sent to ${phoneNumber}`,
      });
    }
  } catch (error) {
    console.log("Error in sendImage", error);
    return res.send({
      status: "Failure",
      message: `sendImage error: ${error}`,
    });
  }
};
/*
 BulkMessage: Sending the same message to multiple users (phoneNumbers) at once
 Max User Limit: 100
 For Later: 
 Include different types of messages: Text Only, Image Only, Image and Text
 */

export const bulkMessage = async (req, res) => {
  /* Expected Input
    "message" : "message",
    "contactInfo" : [{phoneNumber: 'num', countryCode: '91'}] // this field will be stringified
    */
  try {
    const client = getClientInstance(req.params.clientSessionId);
    const { message, contactInfo } = req.body;
    const parsedContactInfo = JSON.parse(contactInfo);
    // check contactInfo length, it should be >= 100
    // if valid then do a map await and send the messages
    if (
      !parsedContactInfo.length ||
      parsedContactInfo.length > BULK_MESSAGE_LIMIT ||
      !message
    ) {
      console.log("Error bulkMessage, invalid input");
      return res.send({
        status: "Failure",
        message: "Error bulkMessage, invalid input",
      });
    }
    await Promise.all(
      parsedContactInfo.map(async (info) => {
        // console.log({ info });
        const { phoneNumber, countryCode } = info;
        await client.sendMessage(`${countryCode}${phoneNumber}@c.us`, message.toString());
      })
    );
    return res.send({
      status: "Success",
      message: `Bulk message has been sent`,
    });
  } catch (error) {
    console.log("Error: BulkMessage", error);
    return res.send({
      status: "Failure",
      message: `bulkMessage error: ${error}`,
    });
  }
};

export const sendButton = async (req, res) => {
  try {
    const client = getClientInstance(req.params.clientSessionId);
    const response = await buttonFlow(`${req.body.phoneNumber}@c.us`, client);
    console.log('response-->',response);
    // console.log({response});
     return res.send({
      status: "success",
      message: "button sent successfully",
    });
  } catch (error) {
    console.log("button error", error);
    return res.send({
      status: "failure",
      message: "error send button",
    });
  }
};

const buttonFlow = async (number, client) => {
  try {
      console.log("buttonflow log", number)

  let embed = new WwebjsSender.MessageEmbed()
    .sizeEmbed(28)
    .setTitle("✅ | Successful process!")
    .setDescription("The process has been successful!")
    .addField("✔", "To confirm")
    .addField("❌", "To cancel")
    .addFields({
      name: "Now you have 2 buttons to choose!",
      value: "✔ or ❌",
    })
    .setFooter("WwebjsSender")
    .setTimestamp();

  let button1 = new WwebjsSender.MessageButton()
    .setCustomId("confirm")
    .setLabel("✔");

  let button2 = new WwebjsSender.MessageButton()
    .setCustomId("cancel")
    .setLabel("❌");
  // console.log({embed})
  return await WwebjsSender.send({
    client,
    number,
    embed: embed,
    button: [button1, button2],
  });
} catch (error) {
  console.log("error",error);
  throw new Error(error)   
}
};
export const sendVideo = async (req, res) => {
  try {
    const client = getClientInstance(req.params.clientSessionId);
    const { phoneNumber, video, caption, countryCode } = req.body;
    if (!phoneNumber || !countryCode || !video ) {
      return res.send({
        status: "error",
        message: "please enter valid phone and base64/url of video",
      });
    }
    let file =video
    let mimetype;
    let filename;
    const attachment = await axios
      .get(file, {
        responseType: "arraybuffer",
      })
      .then((response) => {
        mimetype = response.headers["content-type"];
        filename = file.split("/").pop();
        return response.data.toString("base64");
      });
      if( attachment ){
        const media = new WhatsappClient.MessageMedia('video/mp4', attachment, filename); //application/octet-stream
   //const media = new WhatsappClient.MessageMedia("video/mp4", video);
  
    const {
      id: { fromMe },
    } = await client.sendMessage(`${countryCode}${phoneNumber}@c.us`, media, { sendMediaAsDocument: true });
    if (fromMe) {
      return res.send({
        status: "Success",
        message: `Video has been successfully sent to ${phoneNumber}`,
      });
    }
  }
  } catch (error) {
    console.log("Error in sendVideo", error);
    return res.send({
      status: "Failure",
      message: `sendVideo error: ${error}`,
    });
  }
}

export const sendLocation = async (req, res) => {
  try {
    const client = getClientInstance(req.params.clientSessionId);
    const { phoneNumber, latitude, longitude, countryCode } = req.body;
    if (!phoneNumber || !countryCode || !latitude || !longitude) {
      return res.send({
        status: "error",
        message: "Please enter a valid phone number and coordinates",
      });
    }
    const location =`*Location* \n https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`
   // const location = new WhatsappClient.Location(latitude, longitude, description);
    const {
      id: { fromMe },
    } = await client.sendMessage(`${countryCode}${phoneNumber}@c.us`, location);
    if (fromMe) {
      return res.send({
        status: "success",
        message: `Location has been successfully sent to ${phoneNumber}`,
      });
    }
  } catch (error) {
    console.log("Error in sendLocation", error);
    return res.send({
      status: "failure",
      message: `sendLocation error: ${error}`,
    });
  }
}
var showList={};
export const receiveMessage = async (req, res) => {
  try {
    const client = getClientInstance(req.params.clientSessionId);

client.on("message", async (message) => {
  try {
    console.log("Received a message:", message.body);
    // Check if the message is already in the database
    const existingMessage = await ChatModel.findOne({ messageID: message.id.id });
    if (existingMessage) {
      console.log("Message already saved to database:", message.body);
      return;
    }

    // Save the message to the database
    let media =message._data.body
    let mediatype=message.type
    const chatDetails = await ChatModel({
      SenderName: message.notifyName,
      message: message.body,
      messageFrom: message.from,
      MessageTo: message.to,
      messageTime: message.t,
      messageID: message.id.id,
      media :media,
      type :mediatype
    }).save();
    console.log("Message saved to database successfully:", message.body);

    //autoreply for button data 
    const string = message.body.toString();
const words = string.split("\n");
const firstWord = words[0];

//check button document value 
 let keyToFind =message.body;
 let query = { };
 query["button." + keyToFind] = { $exists: true };
 query.sessionId = message.from;
let document = await sectionModel.findOne(query);
//check section
    let dbdata=await sectionModel.findOne({sessionId:message.from,sectionTitle:firstWord})
    if(dbdata !=null){
    console.log('dbdata-->',dbdata);
    let obj=dbdata.button
    const result = [];
    for (const key in obj) {
      if (Object.hasOwnProperty.call(obj, key)) {
        result.push({ body: key });
      }
    }
    console.log('result-->',result);
    let button = new WhatsappClient.Buttons(`sub menu of *${message.body}*`,result,``,``);
    client.sendMessage(message.from, button);
  }
   //check message for button
  else if(document !=null){
   let value = document.button[keyToFind];
   client.sendMessage(message.from, value);
   }
   else {
    let dbdata=await MenuModel.findOne({sessionId:message.to})
    if (dbdata) {
      let button = new WhatsappClient.List(`${dbdata.body}`, dbdata.menuName, dbdata.section, `${dbdata.title}`, `${dbdata.footer}`);
     client.sendMessage(message.from, button);
    }
   }
   
  }
   catch (error) {
    console.error(error);
    // Handle the error here
  }
});

let findquery = `91${req.params.clientSessionId}@c.us`;
let findchatDetails = await ChatModel.find({}).sort({ createdAt: -1 });

return res.send({
  status: "Success",
  message: "Receiving messages has started",
  findchatDetails,
});
  } catch (error) {
    console.log("Error: receiveMessage", error);
    return res.send({
      status: "Failure",
      message: `receiveMessage error: ${error}`,
    });
  }
};
  //  export const sendButtons = async (req, res) => {
  //   console.log("hello sendButton");
  //   try {
  //     const client = getClientInstance(req.params.clientSessionId);
  //     const { phoneNumber, countryCode, body, buttons, title, footer } = req.body;
  
  //     if (!phoneNumber || !countryCode || !body || !title || !footer) {
  //       return res.send({
  //         status: "error",
  //         message: `Invalid input to sendButton, INPUT: ${req.body}`,
  //       });
  //     }   
  //     let section = req.body.section //[{title:'sectionTitle',rows:[{id:'customId', title:'ListItem2', description: 'desc'},{title:'ListItem2'}]}]
  //    // let button = new WhatsappClient.Buttons(`${body}`,buttonOptions,`${title}`,`${footer}`);
  //    let button = new WhatsappClient.List(`${body}`,'menu',section,`${title}`,`${footer}`);
  //     client.sendMessage(`${countryCode}${phoneNumber}@c.us`, button);
  //     return res.send({
  //       status: "success",
  //       message: `Message with buttons successfully sent to ${phoneNumber}`,
  //     });
  //   } catch (error) {
  //     console.log(`Error: sendButton, ${error}`);
  //     return res.send({ status: "error", message: `Error` });
  //   }
  // };
  
  export const sendButtons = async (req, res) => {
    console.log("hello sendButton");
    try {
      const client = getClientInstance(req.params.clientSessionId);
      const { phoneNumber, countryCode, body, menuName, title, footer } = req.body;
  
      if (!phoneNumber || !countryCode || !body || !title || !footer) {
        return res.send({
          status: "error",
          message: `Invalid input to sendButton, INPUT: ${req.body}`,
        });
      }   
      let section = req.body.section
    
      let button = new WhatsappClient.List(`${body}`, menuName, section, `${title}`, `${footer}`);
      client.sendMessage(`${countryCode}${phoneNumber}@c.us`, button);
      return res.send({
        status: "success",
        message: `Message with buttons successfully sent to ${phoneNumber}`,
      });
    } catch (error) {
      console.log(`Error: sendButton, ${error}`);
      return res.send({ status: "error", message: `Error` });
    }
  };
  
   