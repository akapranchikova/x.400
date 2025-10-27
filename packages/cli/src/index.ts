#!/usr/bin/env node
import 'dotenv/config';

import { buildProgram } from './program';

void buildProgram().parseAsync(process.argv);
