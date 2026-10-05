"use client";

import { useSiteLanguage } from "@/core/i18n/provider";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/core/components/button";
import { InputText } from "@/core/components/input-text";
import { Column, Row } from "@/core/components/layout";
import { SelectorCountry } from "@/core/components/selector-country";

import { createRoomSchema, type CreateRoomSchemaType } from "./schema";

export type CreateRoomFormProps = {
  onCancel?: () => void;
  onSubmit?: (data: CreateRoomSchemaType) => void | Promise<void>;
};

export function CreateRoomForm({ onCancel, onSubmit }: CreateRoomFormProps) {
  const { t } = useSiteLanguage();
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateRoomSchemaType>({
    resolver: zodResolver(createRoomSchema),
    defaultValues: {
      title: "",
      nickname: "",
      password: "",
      targetLanguage: undefined,
      spokenLanguage: undefined,
    },
  });

  async function handleCreateRoom(data: CreateRoomSchemaType) {
    await onSubmit?.(data);
  }

  return (
    <form onSubmit={handleSubmit(handleCreateRoom)} className="w-full">
      <Column className="w-full gap-3">
        <InputText
          label={t("Título da sala")}
          placeholder={t("Título da sala")}
          error={errors.title?.message}
          required
          {...register("title")}
        />
        <InputText
          label={t("Seu nome")}
          placeholder={t("Seu nome")}
          error={errors.nickname?.message}
          required
          {...register("nickname")}
        />
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
          placeholder={t("Senha")}
          type="password"
          autoComplete="new-password"
          error={errors.password?.message}
          required
          {...register("password")}
        />

        <Row className="mt-5 justify-end gap-3">
          <Button
            label={t("Cancelar")}
            variant="ghost"
            rounded="sm"
            type="button"
            disabled={isSubmitting}
            onClick={onCancel}
          />
          <Button
            label={t("Confirmar")}
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
