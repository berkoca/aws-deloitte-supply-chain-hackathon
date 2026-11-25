import { Module } from '@nestjs/common';
import { AgentsController } from './api/agents.controller.js';
import { AgentsService } from './api/agents.service.js';
import { DecisionsController } from './decisions/decisions.controller.js';
import { DecisionsService } from './decisions/decisions.service.js';

@Module({ controllers: [AgentsController, DecisionsController], providers: [AgentsService, DecisionsService] })
export class AppModule {}
