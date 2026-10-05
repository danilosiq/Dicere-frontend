"use client";

import { useSiteLanguage } from "@/core/i18n/provider";

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
import { getSelectableLanguage } from "@/core/components/selector-country/countryList";

import { joinRoomSchema, type JoinRoomSchemaType } from "./schema";

export type JoinRoomFormProps = {
  onSubmit?: (data: JoinRoomSchemaType) => void | Promise<void>;
  onCancel?: () => void;
  initialRoomCode?: string;
  initialName?: string;
  initialTargetLanguage?: DeepLTargetLanguage;
  initialSpokenLanguage?: DeepLTargetLanguage;
  resumeOnly?: boolean;
  className?: string;
};

export function JoinRoomForm({
  onSubmit,
  onCancel,
  initialRoomCode,
  initialName,
  initialTargetLanguage,
  initialSpokenLanguage,
  resumeOnly = false,
  className,
}: JoinRoomFormProps) {
  const { t } = useSiteLanguage();
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
      targetLanguage: getSelectableLanguage(initialTargetLanguage),
      spokenLanguage: getSelectableLanguage(initialSpokenLanguage),
    },
  });

  useEffect(() => {
    reset({
      roomCode: initialRoomCode ? normalizeRoomCode(initialRoomCode) : "",
      name: initialName ?? "",
      password: "",
      targetLanguage: getSelectableLanguage(initialTargetLanguage),
      spokenLanguage: getSelectableLanguage(initialSpokenLanguage),
    });
  }, [
    initialName,
    initialRoomCode,
    initialTargetLanguage,
    initialSpokenLanguage,
    reset,
  ]);

  async function handleJoinRoom(data: JoinRoomSchemaType) {
    await onSubmit?.(data);
  }

  return (
    <form
      noValidate
      className={cn("w-full", className)}
      onSubmit={handleSubmit(handleJoinRoom)}
    >
      <Column className="w-full gap-3">
        {!resumeOnly && (
          <>
            <InputText
              label={t("Código da sala")}
              placeholder={t("Código da sala")}
              mask={normalizeRoomCode}
              error={errors.roomCode?.message}
              required
              {...register("roomCode")}
            />
            <InputText
              label={t("Seu nome")}
              placeholder={t("Seu nome")}
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
              label={t("Idioma que deseja receber as traduções")}
              error={errors.targetLanguage?.message}
              disabled={isSubmitting}
              placeholder={t("Idioma das traduções recebidas")}
              onSelect={field.onChange}
            />
          )}
        />
        <Controller
          control={control}
          name="spokenLanguage"
          render={({ field }) => (
            <SelectorCountry
              value={field.value}
              label={t("Idioma que você irá falar na chamada")}
              placeholder={t("Selecione seu idioma falado")}
              error={errors.spokenLanguage?.message}
              disabled={isSubmitting}
              onSelect={field.onChange}
            />
          )}
        />
        <InputText
          label={t("Senha")}
          placeholder={t("Password")}
          type="password"
          error={errors.password?.message}
          autoComplete="current-password"
          required
          {...register("password")}
        />

        <Row className="mt-5 justify-end gap-3">
          {onCancel && (
            <Button
              label={t("Cancelar")}
              variant="ghost"
              rounded="sm"
              type="button"
              disabled={isSubmitting}
              onClick={onCancel}
            />
          )}
          <Button
            label={t("Confirmar")}
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
