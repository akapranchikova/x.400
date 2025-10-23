#!/usr/bin/env node
import { buildProgram } from './program';

void buildProgram().parseAsync(process.argv);
