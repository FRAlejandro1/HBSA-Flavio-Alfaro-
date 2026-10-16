// Pruebas de duraciones: conversion de textos como 15m o 7d a segundos.
import { describe, expect, it } from 'vitest';
import { duracionASegundos } from '../../../src/shared/utils/duraciones';

describe('duracionASegundos', () => {
  it('convierte segundos, minutos, horas y dias', () => {
    expect(duracionASegundos('30s')).toBe(30);
    expect(duracionASegundos('15m')).toBe(900);
    expect(duracionASegundos('2h')).toBe(7200);
    expect(duracionASegundos('7d')).toBe(604_800);
  });

  it('ignora espacios alrededor', () => {
    expect(duracionASegundos(' 15m ')).toBe(900);
  });

  it('rechaza formatos invalidos', () => {
    expect(() => duracionASegundos('')).toThrow(RangeError);
    expect(() => duracionASegundos('15')).toThrow(RangeError);
    expect(() => duracionASegundos('m')).toThrow(RangeError);
    expect(() => duracionASegundos('1.5h')).toThrow(RangeError);
    expect(() => duracionASegundos('7 dias')).toThrow(RangeError);
  });

  it('rechaza una duracion de cero', () => {
    expect(() => duracionASegundos('0m')).toThrow(RangeError);
  });
});