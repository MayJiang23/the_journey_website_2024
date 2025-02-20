const express = require('express');
const path = require("path");
const bcrypt = require('bcrypt');
const session = require('express-session');
const { User, Journal, Calendar} = require('./config');
const bodyParser = require('body-parser');
const multer = require('multer');

const app = express();

//Storage for image upload
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/')
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});

const upload = multer({ storage: storage });

app.use(express.json());

app.use(express.urlencoded({extended: false}));

app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

app.set('view engine', 'ejs');

app.use(express.static("public"));

// Serve static images
app.use('/uploads', express.static(path.join(__dirname, "uploads")));

app.get('/login', (req,res) => {
    if(req.session.user) {
        res.render('login', {
            user: req.session.username,
			profile_pic: req.session.profile_pic
        });
    }else {
        res.render('login', {
            username: null
        });
    }
});

app.get('/signup', (req,res) => {
    res.render('signup');
});

app.get('/main', (req, res) => {
    res.render('main', { username: req.session.username, profile_pic: req.session.profile_pic });

});

app.get('/about', (req, res) => {
    res.render('about', { username: req.session.username, profile_pic: req.session.profile_pic });
});

app.get('/user', async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        const journalEntries = await Journal.find({ user_id: userId })
        .sort({ date: -1 }) 
        //.limit(5); 

        res.render('user', {
            username: req.session.username,
			profile_pic: req.session.profile_pic,
            journalEntries: journalEntries
        });
    } catch (error) {
        console.error('Error fetching journal entries:', error);
        res.status(500).send('Failed to fetch journal entries');
    }
});


app.get('/resources', (req, res) => {
    res.render('resources', { username: req.session.username });
});


app.get('/calendar', async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        const events = await Calendar.find({ user_id: userId })
            .sort({ date: -1 })
            .limit(5);

        // Convert event dates to 'YYYY-MM-DD' format for easier comparison in the frontend
        const formattedEvents = events.map(event => ({
            ...event.toObject(),
            date: event.date.toISOString().split('T')[0]  // Convert to 'YYYY-MM-DD' format
        }));

        res.render('calendar', {
            username: req.session.username,
            events: formattedEvents
        });
    } catch (error) {
        console.error('Error fetching events:', error);
        res.status(500).send('Failed to fetch events');
    }
});



app.get('/journal', async (req, res) => {
    const userId = req.session.userId;

    if (!userId) {
        return res.redirect('/login');
    }

    try {
        const journalEntries = await Journal.find({ user_id: userId })
            .sort({ date: -1 })
            .limit(5);

        res.render('journal', {
            username: req.session.username,
            journalEntries: journalEntries
        });
    } catch (error) {
        console.error('Error fetching journal entries:', error);
        res.status(500).send('Failed to fetch journal entries');
    }
});

app.get('/user-journal', async (req, res) => {
        const userId = req.session.userId;
    
        if (!userId) {
            return res.redirect('/login');
        }
    
        try {
            const journalEntries = await Journal.find({ user_id: userId })
                .sort({ date: -1 })
                .limit(5);
    
            res.json(journalEntries);
        } catch (error) {
            console.error('Error fetching journal entries:', error);
            res.status(500).send('Failed to fetch journal entries');
        }    
});

app.post('/journal', async (req, res) => {
    const { title, content, mood, date } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(400).send('User not logged in');
    }
    try {
        console.log('Received journal entry:', { title, content, mood, date });

        const newJournalEntry = new Journal({
            user_id: userId,
            title: title,
            content: content,
            mood: mood,
            date: date,
        });
        await newJournalEntry.save();
        const journalEntries = await Journal.find({ user_id: userId })
            .sort({ date: -1 })
            .limit(5);

        res.json({ success: true, journalEntries: journalEntries });
    } catch (error) {
        console.error('Error saving journal entry:', error);
        res.status(500).send('Failed to save journal entry');
    }
});


app.post("/signup", async (req, res) => {
    const data = {
        username: req.body.username,
        password: req.body.password
    }

    const existingUser = await User.findOne({ username: data.username });

    if (existingUser) {
        return res.send("An account already exists with that username. Please choose a different username.");
    } else {
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(data.password, saltRounds);

        data.password = hashedPassword;

        const userData = new User(data); 
        await userData.save();

        console.log("User created successfully:", userData);
    }

    res.render('main', { username: req.body.username });
});

app.post('/calendar', async (req, res) => {
    const { name, date, notes } = req.body;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(400).send('User not logged in');
    }

    try {
        // Create a new event and save it to the database
        const newEvent = new Calendar({
            user_id: userId,
            name: name,
            date: new Date(date),  // Ensure correct date format
            notes: notes
        });

        await newEvent.save();  // Save event to the database

        res.json({ success: true, message: 'Event created successfully' });
    } catch (error) {
        console.error('Error saving event:', error);
        res.status(500).send('Failed to save event');
    }
});

app.delete('/calendar', async (req, res) => {
    const userId = req.session.userId;
    const eventId = req.body.eventId;  // Get the event ID from the request body

    if (!userId) {
        return res.status(401).send('User not logged in');  // Ensure the user is logged in
    }

    if (!eventId) {
        return res.status(400).send('Event ID is required');  // Make sure an event ID is provided
    }

    try {
        // Find the event by its ID and ensure it belongs to the logged-in user
        const event = await Calendar.findOne({ _id: eventId, user_id: userId });

        if (!event) {
            return res.status(404).send('Event not found or does not belong to this user');
        }

        // Delete the event
        await Calendar.findByIdAndDelete(eventId);

        res.json({ success: true, message: 'Event deleted successfully' });  // Send success response
    } catch (error) {
        console.error('Error deleting event:', error);
        res.status(500).send('Failed to delete event');  // Handle any errors
    }
});


app.post("/login", async (req, res) => {
    try {
        const check = await User.findOne({ username: req.body.username });

        if (!check) {
            return res.send("Username not found");
        }

        const isPasswordMatch = await bcrypt.compare(req.body.password, check.password);
        if (isPasswordMatch) {
            req.session.username = check.username;
            req.session.userId = check._id;
			req.session.profile_pic = check.profile_pic;
            res.redirect('/main');
        } else {
            res.send("Incorrect password");
        }

    } catch (error) {
        console.error("Error during login:", error); 
        res.send("Something went wrong, please try again.");
    }
});

app.post('/change-password', async (req, res) => {
    const newPassword = req.body.newPassword;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(400).send('User not logged in');
    }

    try {
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        console.log("Hashed Password: ", hashedPassword);

        const result = await User.updateOne(
            { _id: userId },
            { $set: { password: hashedPassword } }
        );

        console.log("Update Result: ", result);

        if (result.modifiedCount === 1) {
            console.log("Password successfully updated!");
            res.redirect('/user');
        } else {
            console.log("Password update failed!");
            res.status(500).send('Error updating password.');
        }
    } catch (err) {
        console.error('Error during password update:', err);
        res.status(500).send('Something went wrong, please try again.');
    }
});

app.post('/change-username', async (req, res) => {
    const newUsername = req.body.newUsername;
    const userId = req.session.userId;

    if (!userId) {
        return res.status(400).send('User not logged in');
    }

    try {
        const existingUser = await User.findOne({ username: newUsername });

        if (existingUser) {
            return res.status(400).send("This username is already taken. Please choose a different one.");
        }

        const result = await User.updateOne(
            { _id: userId },
            { $set: { username: newUsername } }
        );

        console.log("Update Result: ", result);

        if (result.modifiedCount === 1) {
            req.session.username = newUsername;
            console.log("Username successfully updated!");
            res.redirect('/user');
        } else {
            console.log("Username update failed!");
            res.status(500).send('Error updating username.');
        }
    } catch (err) {
        console.error('Error during username update:', err);
        res.status(500).send('Something went wrong with username, please try again.');
    }
});

app.post('/change-profilepic', upload.single('profile_pic'), async (req, res) => {
	if (!req.file) {
        return res.status(400).send("No file uploaded.");
    }
	const name = req.file.filename; // Assuming multer saves the file path
	//Now we need to store this in the database
    /** @todo This needs to be removed later, should dynamically construct the image path and only save the name of the file */ 
	const imagePath = `http://localhost:5001/uploads/${name}`; //
	const userId = req.session.userId;
	
	
	if (!userId) {
		//Hopefully never reached here because this is fatal error
		return res.status(400).send("User not logged in.");
	}
	
	try {
		const existingUser = await User.findOne({ _id: userId });
		
		if (existingUser) {
			const result = await User.updateOne(
				{ _id: userId },
				{ $set: { profile_pic: imagePath } }
			);
			
			console.log("Update Result: ", result);
			
			if (result.acknowledged) {
				req.session.profile_pic = imagePath;
				/** @todo Needs to update cookie as well! Add this after the branches merged together. */
				console.log("Profile picture successfully updated!");
				res.redirect('/user');
			} else {
				console.log("User profile picture update failed!");
				res.status(500).send('Error updating username.');
			}
		}
	} catch (err) {
		console.error("Error during profile picture update: ", err);
		res.status(500).send("Profile picture update fails, check to see errors and try again");
	}
});


app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            console.log("Error logging out");
        }
        res.redirect('/login');
    });
});


const port = 5001;
app.listen(port, () => {
    console.log(`Server running on Port: ${port}`);
})