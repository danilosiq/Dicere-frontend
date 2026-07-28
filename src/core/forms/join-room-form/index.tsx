"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { useEffect } from "react";

import { Button } from "@/core/components/button";
import { InputText } from "@/core/components/input-text";
import { Column, Row } from "@/core/components/layout";
import { cn } from "@/core/utils/cn";
import { normalizeRoomCode } from "@/core/@types/room";
import { SelectorCountry } from "@/core/components/selector-country";
import type { DeepLTargetLanguage } from "@/core/components/selector-country";

import { joinRoomSchema, type JoinRoomSchemaType } from "./schema";

export type JoinRoomFormProps = {
  onSubmit?: (data: JoinRoomSchemaType) => void | Promise<void>;
  onCancel?: () => void;
  initialRoomCode?: string;
  initialName?: string;
  initialTargetLanguage?: DeepLTargetLanguage;
  resumeOnly?: boolean;
  className?: string;
};

export function JoinRoomForm({
  onSubmit,
  onCancel,
  initialRoomCode,
  initialName,
  initialTargetLanguage,
  resumeOnly = false,
  className,
}: JoinRoomFormProps) {
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<JoinRoomSchemaType>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: {
      roomCode: initialRoomCode ? normalizeRoomCode(initialRoomCode) : "",
      name: initialName ?? "",
      password: "",
      targetLanguage: initialTargetLanguage,
    },
  });

  useEffect(() => {
    reset({
      roomCode: initialRoomCode ? normalizeRoomCode(initialRoomCode) : "",
      name: initialName ?? "",
      password: "",
      targetLanguage: initialTargetLanguage,
    });
  }, [initialName, initialRoomCode, initialTargetLanguage, reset]);

  async function handleJoinRoom(data: JoinRoomSchemaType) {
    await onSubmit?.(data);
  }

  return (
    <form
      className={cn("w-full", className)}
      onSubmit={handleSubmit(handleJoinRoom)}
    >
      <Column className="w-full gap-3">
        {!resumeOnly && (
          <>
            <InputText
              label="Código da sala"
              placeholder="Código da sala"
              mask={normalizeRoomCode}
              error={errors.roomCode?.message}
              required
              {...register("roomCode")}
            />
            <InputText
              label="Seu nome"
              placeholder="Seu nome"
              error={errors.name?.message}
              autoComplete="name"
              required
              {...register("name")}
            />
          </>
        )}
        <Controller
          control={control}
          name="targetLanguage"
          render={({ field }) => (
            <SelectorCountry
              value={field.value}
              placeholder="Idioma das traduções recebidas"
              onSelect={field.onChange}
            />
          )}
        />
        {errors.targetLanguage?.message && (
          <p className="text-error text-sm" role="alert">
            {errors.targetLanguage.message}
          </p>
        )}
        <InputText
          label="Senha"
          placeholder="Password"
          type="password"
          error={errors.password?.message}
          autoComplete="current-password"
          required
          {...register("password")}
        />

        <Row className="mt-5 justify-end gap-3">
          {onCancel && (
            <Button
              label="Cancelar"
              variant="ghost"
              rounded="sm"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            />
          )}
          <Button
            label="Confirmar"
            variant="secondary"
            rounded="sm"
            type="submit"
            loading={isSubmitting}
            disabled={isSubmitting}
          />
        </Row>
      </Column>
    </form>
  );
}
