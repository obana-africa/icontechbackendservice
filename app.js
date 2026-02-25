require('dotenv').config()
const express = require('express');
const cors = require('cors')


const requestsRoute = require('./src/routes/requests');


// T2Mobile Integration routes
const t2mobileRoute = require('./src/routes/t2mobile');


const PORT = process.env.PORT;
const app = express();

app.use(express.json());

// Session and Passport setup
const session = require('express-session');

app.use(session({ secret: 'IconTech_secret', resave: false, saveUninitialized: true }));


/**
 * Cross Origin Request Service
 * -Set all allowed origins here to enable cross origin requests 
 **/
const corsOptions = {
	origin: [
		"*",
		"https://obana.africa",

	],
};
app.use(cors(corsOptions));


/**
 * T2Mobile Integration Setup
 */
// Load and validate T2Mobile configuration
const t2mobileConfig = require('./src/config/t2mobile');
try {
    if (process.env.T2MOBILE_API_KEY) {
        t2mobileConfig.validateConfig();
        console.log('T2Mobile configuration validated');
        
        
        const JobHelper = require('./src/helpers/jobHelper');
        const T2MobileOrderJob = require('./src/jobs/t2mobileOrderJob');
        const WebhookRetryJob = require('./src/jobs/webhookRetryJob');
        
        
        JobHelper.processQueue(
            JobHelper.QUEUES.T2MOBILE_ORDER,
            async (job) => T2MobileOrderJob.process(job)
        );
        
        JobHelper.processQueue(
            JobHelper.QUEUES.WEBHOOK_RETRY,
            async (job) => WebhookRetryJob.process(job)
        );
        
        console.log('Job queues initialized');
        
        
        const T2MobileScheduler = require('./src/schedulers/t2mobileScheduler');
        T2MobileScheduler.initialize();
        
        
        app.use('/t2mobile', t2mobileRoute);
        
    } else {
        console.log('⚠ T2MOBILE_API_KEY not set - T2Mobile integration disabled');
    }
} catch (error) {
    console.error('⚠ T2Mobile configuration error:', error.message);
    console.log('ℹ T2Mobile integration will not be available');
}


/**
 * Swagger setup and definitions
 **/
const swaggerJSDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const swaggerOptions = {
    swaggerDefinition: {
        openapi: '3.0.0',
        info: {
            title: 'Icontec API',
            version: '1.0.0',
            description: 'IconTech API Docummentation',
            contact: {
                name: "Anyanwu Chimebuka"
            },
        },
        servers: [
            {
                url: `http://localhost:${PORT}`
            },
            {
                url: `http://api.tajiri.xyz`
            }
        ]
    },
    apis: [
        './app.js',
        './src/routes/*.js',
    ]
}
const swaggerSpec = swaggerJSDoc(swaggerOptions)
app.use('/api-doc', swaggerUi.serve, swaggerUi.setup(swaggerSpec))


/**
 * @swagger
 * /:
 *  get:
 *    description: Default api test url
 *    responses:
 *      '200':
 *        description: API is running
 */
app.get('/', (req, res) => {
    res.send('Welcome to IconTech Project.');
})


/**
 * Middlewares and routes
 **/

app.use(express.urlencoded({ extended: false }));
app.use((req, res, next) => {
    console.log(`${req.method} - ${req.url}`);
    next();
})



app.use('/requests', requestsRoute);

app.use('/partner', t2mobileRoute);


app.listen(PORT, () => {
    console.log(`IconTech API is running on port ${PORT}`);
})

