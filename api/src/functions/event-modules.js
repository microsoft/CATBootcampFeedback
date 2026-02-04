/**
 * Event Modules API
 * GET /api/events/{eventId}/modules - Get modules for an event
 * POST /api/event-modules - Add a module to an event
 * DELETE /api/event-modules/{eventModuleId} - Remove a module from an event
 */

const { app } = require('@azure/functions');
const { query } = require('../shared/database');
const { success, error } = require('../shared/utils');

// GET modules for a specific event
app.http('getEventModules', {
    methods: ['GET'],
    authLevel: 'anonymous',
    route: 'events/{eventId}/modules',
    handler: async (request, context) => {
        try {
            const eventId = request.params.eventId;

            if (!eventId) {
                const errorResponse = error(400, 'Event ID is required', 'INVALID_REQUEST');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Get modules for this event
            const modules = await query(`
                SELECT
                    em.EventModuleId,
                    em.EventId,
                    em.ModuleId,
                    m.ModuleName,
                    em.SpeakerName,
                    em.DeliveryOrder,
                    em.DeliveryDate,
                    em.Notes,
                    m.Description,
                    m.IsActive
                FROM EventModules em
                INNER JOIN Modules m ON em.ModuleId = m.ModuleId
                WHERE em.EventId = @eventId
                ORDER BY em.DeliveryOrder ASC
            `, { eventId: parseInt(eventId) });

            const transformedModules = modules.map(em => ({
                eventModuleId: em.EventModuleId,
                eventId: em.EventId,
                moduleId: em.ModuleId,
                moduleName: em.ModuleName,
                speakerName: em.SpeakerName,
                deliveryOrder: em.DeliveryOrder,
                deliveryDate: em.DeliveryDate,
                notes: em.Notes,
                description: em.Description,
                isActive: em.IsActive
            }));

            const response = success(transformedModules);
            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error getting event modules:', err);
            const errorResponse = error(500, `Error getting event modules: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});

// POST - Add module to event
app.http('addEventModule', {
    methods: ['POST'],
    authLevel: 'anonymous',
    route: 'event-modules',
    handler: async (request, context) => {
        try {
            // Parse request body
            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            const { eventId, moduleId, speakerName, deliveryOrder, deliveryDate, notes } = body;

            // Validate required fields
            if (!eventId || !moduleId || !speakerName) {
                const errorResponse = error(400, 'Event ID, Module ID, and Speaker Name are required', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Check if this module is already added to this event
            const existingCheck = await query(`
                SELECT EventModuleId
                FROM EventModules
                WHERE EventId = @eventId AND ModuleId = @moduleId
            `, {
                eventId: parseInt(eventId),
                moduleId: parseInt(moduleId)
            });

            if (existingCheck.length > 0) {
                const errorResponse = error(400, 'This module is already added to this event', 'DUPLICATE_MODULE');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Insert event module
            const result = await query(`
                INSERT INTO EventModules (EventId, ModuleId, SpeakerName, DeliveryOrder, DeliveryDate, Notes, CreatedAt)
                OUTPUT INSERTED.EventModuleId, INSERTED.EventId, INSERTED.ModuleId,
                       INSERTED.SpeakerName, INSERTED.DeliveryOrder, INSERTED.DeliveryDate, INSERTED.Notes
                VALUES (@eventId, @moduleId, @speakerName, @deliveryOrder, @deliveryDate, @notes, GETDATE())
            `, {
                eventId: parseInt(eventId),
                moduleId: parseInt(moduleId),
                speakerName: speakerName.trim(),
                deliveryOrder: deliveryOrder || 1,
                deliveryDate: deliveryDate || null,
                notes: notes ? notes.trim() : null
            });

            const created = result[0];

            context.log(`Module ${moduleId} added to event ${eventId}`);

            const response = success({
                message: 'Module added to event successfully',
                eventModule: {
                    eventModuleId: created.EventModuleId,
                    eventId: created.EventId,
                    moduleId: created.ModuleId,
                    speakerName: created.SpeakerName,
                    deliveryOrder: created.DeliveryOrder,
                    deliveryDate: created.DeliveryDate,
                    notes: created.Notes
                }
            }, 201);

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error adding module to event:', err);
            const errorResponse = error(500, `Error adding module to event: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});

// DELETE - Remove module from event
app.http('removeEventModule', {
    methods: ['DELETE'],
    authLevel: 'anonymous',
    route: 'event-modules/{eventModuleId}',
    handler: async (request, context) => {
        try {
            const eventModuleId = request.params.eventModuleId;

            if (!eventModuleId) {
                const errorResponse = error(400, 'Event Module ID is required', 'INVALID_REQUEST');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Check if event module exists
            const existing = await query(
                'SELECT EventModuleId FROM EventModules WHERE EventModuleId = @eventModuleId',
                { eventModuleId: parseInt(eventModuleId) }
            );

            if (existing.length === 0) {
                const errorResponse = error(404, 'Event module not found', 'NOT_FOUND');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Delete the event module
            await query(
                'DELETE FROM EventModules WHERE EventModuleId = @eventModuleId',
                { eventModuleId: parseInt(eventModuleId) }
            );

            context.log(`Event module ${eventModuleId} removed`);

            const response = success({
                message: 'Module removed from event successfully',
                eventModuleId: parseInt(eventModuleId)
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error removing module from event:', err);
            const errorResponse = error(500, `Error removing module from event: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});

// PUT - Update module delivery order
app.http('updateModuleOrder', {
    methods: ['PUT'],
    authLevel: 'anonymous',
    route: 'event-modules/{eventModuleId}/order',
    handler: async (request, context) => {
        try {
            const eventModuleId = request.params.eventModuleId;

            if (!eventModuleId) {
                const errorResponse = error(400, 'Event Module ID is required', 'INVALID_REQUEST');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Parse request body
            const bodyText = await request.text();
            const body = JSON.parse(bodyText);
            const { newOrder } = body;

            if (!newOrder || newOrder < 1) {
                const errorResponse = error(400, 'Valid new order (>= 1) is required', 'INVALID_DATA');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            // Get current module info
            const currentModule = await query(
                'SELECT EventModuleId, EventId, DeliveryOrder FROM EventModules WHERE EventModuleId = @eventModuleId',
                { eventModuleId: parseInt(eventModuleId) }
            );

            if (currentModule.length === 0) {
                const errorResponse = error(404, 'Event module not found', 'NOT_FOUND');
                return {
                    status: errorResponse.status,
                    headers: errorResponse.headers,
                    body: errorResponse.body
                };
            }

            const { EventId, DeliveryOrder: currentOrder } = currentModule[0];

            // If order hasn't changed, just return success
            if (currentOrder === newOrder) {
                const response = success({
                    message: 'Module order unchanged',
                    eventModuleId: parseInt(eventModuleId),
                    deliveryOrder: newOrder
                });
                return {
                    status: response.status,
                    headers: response.headers,
                    body: response.body
                };
            }

            // Reorder modules
            if (newOrder < currentOrder) {
                // Moving up: shift modules down between newOrder and currentOrder
                await query(`
                    UPDATE EventModules
                    SET DeliveryOrder = DeliveryOrder + 1
                    WHERE EventId = @eventId
                      AND DeliveryOrder >= @newOrder
                      AND DeliveryOrder < @currentOrder
                `, {
                    eventId: EventId,
                    newOrder: newOrder,
                    currentOrder: currentOrder
                });
            } else {
                // Moving down: shift modules up between currentOrder and newOrder
                await query(`
                    UPDATE EventModules
                    SET DeliveryOrder = DeliveryOrder - 1
                    WHERE EventId = @eventId
                      AND DeliveryOrder > @currentOrder
                      AND DeliveryOrder <= @newOrder
                `, {
                    eventId: EventId,
                    currentOrder: currentOrder,
                    newOrder: newOrder
                });
            }

            // Update the current module to new position
            await query(`
                UPDATE EventModules
                SET DeliveryOrder = @newOrder
                WHERE EventModuleId = @eventModuleId
            `, {
                eventModuleId: parseInt(eventModuleId),
                newOrder: newOrder
            });

            context.log(`Module ${eventModuleId} order changed from ${currentOrder} to ${newOrder}`);

            const response = success({
                message: 'Module order updated successfully',
                eventModuleId: parseInt(eventModuleId),
                oldOrder: currentOrder,
                newOrder: newOrder
            });

            return {
                status: response.status,
                headers: response.headers,
                body: response.body
            };

        } catch (err) {
            context.log('Error updating module order:', err);
            const errorResponse = error(500, `Error updating module order: ${err.message}`, 'SERVER_ERROR');
            return {
                status: errorResponse.status,
                headers: errorResponse.headers,
                body: errorResponse.body
            };
        }
    }
});
