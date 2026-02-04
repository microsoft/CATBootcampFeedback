/**
 * Load Test Data API
 * POST /api/load-test-data
 * Loads test feedback data into the database
 * TEMPORARY ENDPOINT - Remove after initial data load
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');

app.http('load-test-data', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'load-test-data',
    handler: async (request, context) => {
        try {
            context.log('Loading test data...');

            // Step 1: Update speaker names
            context.log('Step 1: Updating speaker names...');
            await query(`
                UPDATE EventModules SET SpeakerName = 'Dr. Sarah Chen' WHERE EventModuleId = 1 AND SpeakerName = 'TBD';
                UPDATE EventModules SET SpeakerName = 'Michael Rodriguez' WHERE EventModuleId = 2 AND SpeakerName = 'TBD';
                UPDATE EventModules SET SpeakerName = 'Prof. David Thompson' WHERE EventModuleId = 3 AND SpeakerName = 'TBD';
            `);

            // Step 2: Load feedback for Event 1 (CSXYZ789 - Advanced Topics)
            context.log('Step 2: Loading feedback for Advanced Topics...');
            const eventModule1 = 1;

            const existingFeedback1 = await query('SELECT COUNT(*) as count FROM Feedback WHERE EventModuleId = @eventModuleId', { eventModuleId: eventModule1 });

            if (existingFeedback1[0].count === 0) {
                await query(`
                    INSERT INTO Feedback (EventModuleId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt, IpAddress)
                    VALUES
                        (@eventModuleId, 'CSXYZ789', 5, 'Just Right', 5, 'Outstanding presentation! Dr. Chen explained complex concepts with clarity.', DATEADD(HOUR, -2, GETDATE()), '192.168.1.101'),
                        (@eventModuleId, 'CSXYZ789', 5, 'Just Right', 5, 'Best session I''ve attended this year.', DATEADD(HOUR, -3, GETDATE()), '192.168.1.102'),
                        (@eventModuleId, 'CSXYZ789', 5, 'Just Right', 5, 'Exceptional depth of knowledge.', DATEADD(HOUR, -4, GETDATE()), '192.168.1.103'),
                        (@eventModuleId, 'CSXYZ789', 4, 'Just Right', 4, 'Great content overall.', DATEADD(HOUR, -5, GETDATE()), '192.168.1.104'),
                        (@eventModuleId, 'CSXYZ789', 4, 'Just Right', 4, 'Solid presentation with good examples.', DATEADD(HOUR, -6, GETDATE()), '192.168.1.105'),
                        (@eventModuleId, 'CSXYZ789', 5, 'Too Technical', 4, 'Very knowledgeable speaker, but quite advanced.', DATEADD(HOUR, -7, GETDATE()), '192.168.1.106'),
                        (@eventModuleId, 'CSXYZ789', 4, 'Just Right', 4, 'Informative session with helpful case studies.', DATEADD(HOUR, -8, GETDATE()), '192.168.1.107'),
                        (@eventModuleId, 'CSXYZ789', 4, 'Too Technical', 3, 'Good speaker, but material was quite technical.', DATEADD(HOUR, -9, GETDATE()), '192.168.1.108'),
                        (@eventModuleId, 'CSXYZ789', 3, 'Just Right', 3, 'Decent session, could be more engaging.', DATEADD(HOUR, -10, GETDATE()), '192.168.1.109'),
                        (@eventModuleId, 'CSXYZ789', 4, 'Just Right', 4, 'Learned a lot about advanced topics.', DATEADD(HOUR, -11, GETDATE()), '192.168.1.110'),
                        (@eventModuleId, 'CSXYZ789', 3, 'Too Technical', 3, 'Speaker knew material, but too advanced for me.', DATEADD(HOUR, -12, GETDATE()), '192.168.1.111'),
                        (@eventModuleId, 'CSXYZ789', 4, 'Too Technical', 3, 'Well organized but very technical.', DATEADD(HOUR, -13, GETDATE()), '192.168.1.112'),
                        (@eventModuleId, 'CSXYZ789', 5, 'Just Right', 5, 'Excellent! Would love a follow-up workshop.', DATEADD(HOUR, -14, GETDATE()), '192.168.1.113'),
                        (@eventModuleId, 'CSXYZ789', 4, 'Just Right', 4, 'Very valuable content and resources.', DATEADD(HOUR, -15, GETDATE()), '192.168.1.114'),
                        (@eventModuleId, 'CSXYZ789', 5, 'Just Right', 5, 'Fantastic speaker with clear explanations!', DATEADD(HOUR, -16, GETDATE()), '192.168.1.115')
                `, { eventModuleId: eventModule1 });
                context.log('Added 15 feedback entries for CSXYZ789');
            }

            // Step 3: Load feedback for Event 2 (CSABC456 - Best Practices)
            context.log('Step 3: Loading feedback for Best Practices...');
            const eventModule2 = 2;

            const existingFeedback2 = await query('SELECT COUNT(*) as count FROM Feedback WHERE EventModuleId = @eventModuleId', { eventModuleId: eventModule2 });

            if (existingFeedback2[0].count === 0) {
                await query(`
                    INSERT INTO Feedback (EventModuleId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt, IpAddress)
                    VALUES
                        (@eventModuleId, 'CSABC456', 5, 'Just Right', 5, 'Michael really knows his stuff!', DATEADD(HOUR, -1, GETDATE()), '192.168.2.201'),
                        (@eventModuleId, 'CSABC456', 5, 'Just Right', 5, 'Incredibly practical session.', DATEADD(HOUR, -2, GETDATE()), '192.168.2.202'),
                        (@eventModuleId, 'CSABC456', 5, 'Just Right', 5, 'Love the focus on industry standards.', DATEADD(HOUR, -3, GETDATE()), '192.168.2.203'),
                        (@eventModuleId, 'CSABC456', 4, 'Just Right', 4, 'Great practical tips.', DATEADD(HOUR, -4, GETDATE()), '192.168.2.204'),
                        (@eventModuleId, 'CSABC456', 4, 'Just Right', 4, 'Very applicable to my daily work.', DATEADD(HOUR, -5, GETDATE()), '192.168.2.205'),
                        (@eventModuleId, 'CSABC456', 5, 'Just Right', 4, 'Excellent speaker with deep knowledge.', DATEADD(HOUR, -6, GETDATE()), '192.168.2.206'),
                        (@eventModuleId, 'CSABC456', 4, 'Just Right', 4, 'Solid content, well structured.', DATEADD(HOUR, -7, GETDATE()), '192.168.2.207'),
                        (@eventModuleId, 'CSABC456', 4, 'Just Right', 4, 'Good overview, already implementing ideas.', DATEADD(HOUR, -8, GETDATE()), '192.168.2.208'),
                        (@eventModuleId, 'CSABC456', 3, 'Too Low Level', 3, 'Useful but somewhat basic.', DATEADD(HOUR, -9, GETDATE()), '192.168.2.209'),
                        (@eventModuleId, 'CSABC456', 4, 'Just Right', 4, 'Practical and relevant Q&A.', DATEADD(HOUR, -10, GETDATE()), '192.168.2.210'),
                        (@eventModuleId, 'CSABC456', 4, 'Just Right', 4, 'Could benefit from more interactive exercises.', DATEADD(HOUR, -11, GETDATE()), '192.168.2.211'),
                        (@eventModuleId, 'CSABC456', 5, 'Just Right', 5, 'Exceptional! Every team should attend.', DATEADD(HOUR, -12, GETDATE()), '192.168.2.212')
                `, { eventModuleId: eventModule2 });
                context.log('Added 12 feedback entries for CSABC456');
            }

            // Step 4: Load feedback for Event 3 (CSA1B2C3 - Introduction)
            context.log('Step 4: Loading feedback for Introduction...');
            const eventModule3 = 3;

            const existingFeedback3 = await query('SELECT COUNT(*) as count FROM Feedback WHERE EventModuleId = @eventModuleId', { eventModuleId: eventModule3 });

            if (existingFeedback3[0].count === 0) {
                await query(`
                    INSERT INTO Feedback (EventModuleId, EventCode, SpeakerKnowledge, ContentDepth, ModuleSatisfaction, AdditionalComments, SubmittedAt, IpAddress)
                    VALUES
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'Perfect introduction! Prof. Thompson made complex topics accessible.', DATEADD(HOUR, -1, GETDATE()), '192.168.3.301'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'Excellent overview with just the right detail.', DATEADD(HOUR, -2, GETDATE()), '192.168.3.302'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'Best intro session ever!', DATEADD(HOUR, -3, GETDATE()), '192.168.3.303'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'Superb introduction with welcoming environment.', DATEADD(HOUR, -4, GETDATE()), '192.168.3.304'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Just Right', 4, 'Great kick-off, good pace.', DATEADD(HOUR, -5, GETDATE()), '192.168.3.305'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Just Right', 4, 'Very helpful with clear roadmap.', DATEADD(HOUR, -6, GETDATE()), '192.168.3.306'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 4, 'Excellent speaker, more hands-on would be good.', DATEADD(HOUR, -7, GETDATE()), '192.168.3.307'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Just Right', 4, 'Good foundation with helpful examples.', DATEADD(HOUR, -8, GETDATE()), '192.168.3.308'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Too Low Level', 3, 'Solid intro but basic for experienced folks.', DATEADD(HOUR, -9, GETDATE()), '192.168.3.309'),
                        (@eventModuleId, 'CSA1B2C3', 3, 'Just Right', 3, 'Decent, would appreciate more visuals.', DATEADD(HOUR, -10, GETDATE()), '192.168.3.310'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Just Right', 4, 'Good overview, looking forward to more.', DATEADD(HOUR, -11, GETDATE()), '192.168.3.311'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'As a beginner, this was exactly what I needed!', DATEADD(HOUR, -12, GETDATE()), '192.168.3.312'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'Friendly, clear, and comprehensive!', DATEADD(HOUR, -13, GETDATE()), '192.168.3.313'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Just Right', 4, 'Welcoming atmosphere, great start.', DATEADD(HOUR, -14, GETDATE()), '192.168.3.314'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'Inspiring! The enthusiasm is contagious.', DATEADD(HOUR, -15, GETDATE()), '192.168.3.315'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Just Right', 4, 'Well-paced with good examples.', DATEADD(HOUR, -16, GETDATE()), '192.168.3.316'),
                        (@eventModuleId, 'CSA1B2C3', 5, 'Just Right', 5, 'Comprehensive and clear journey start.', DATEADD(HOUR, -17, GETDATE()), '192.168.3.317'),
                        (@eventModuleId, 'CSA1B2C3', 4, 'Just Right', 4, 'Informative with especially helpful Q&A.', DATEADD(HOUR, -18, GETDATE()), '192.168.3.318')
                `, { eventModuleId: eventModule3 });
                context.log('Added 18 feedback entries for CSA1B2C3');
            }

            // Get final counts
            const stats = await query(`
                SELECT
                    (SELECT COUNT(*) FROM Modules WHERE IsActive = 1) as ModuleCount,
                    (SELECT COUNT(*) FROM Events WHERE IsActive = 1) as EventCount,
                    (SELECT COUNT(*) FROM EventModules) as EventModuleCount,
                    (SELECT COUNT(*) FROM Feedback) as FeedbackCount
            `);

            return {
                status: 200,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: true,
                    message: 'Test data loaded successfully!',
                    statistics: {
                        modules: stats[0].ModuleCount,
                        events: stats[0].EventCount,
                        eventModules: stats[0].EventModuleCount,
                        feedback: stats[0].FeedbackCount
                    }
                })
            };

        } catch (error) {
            context.log('Error loading test data:', error);
            return {
                status: 500,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    success: false,
                    message: `Error loading test data: ${error.message}`
                })
            };
        }
    }
});
